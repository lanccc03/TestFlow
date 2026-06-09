# 真实测试框架接入指南

本文档说明如何把 TestFlow 当前的 mock 自动化运行时替换为真实测试框架。`real_runtime.py` 不保留占位实现；只有在明确接入具体框架时再新增。

## 目标

真实框架接入后，TestFlow 仍然只负责平台侧能力：

- 展示框架用例目录。
- 创建、排队、取消和查询执行任务。
- 写入任务日志、执行历史和报告目录。
- 通过 WebSocket 推送任务状态和日志。

真实测试框架负责框架侧能力：

- 发现和解析真实用例。
- 读取和写入框架配置。
- 执行指定用例。
- 在取消任务或服务关闭时停止真实执行。
- 生成框架报告或产物。

二者之间只通过 `AutotestRuntime` 协议交互，不让 FastAPI route、执行服务或前端直接依赖具体框架 SDK。

## 当前边界

- `backend/autotest/runtime.py` 定义 `AutotestRuntime` 协议。
- `backend/autotest/entry.py` 是业务入口，负责把用例列表、配置读写和执行请求委托给当前 runtime。
- `backend/autotest/registry.py` 根据 `TESTFLOW_AUTOTEST_RUNTIME` 选择 runtime；当前只可用 `mock`。
- `backend/autotest/mock_runtime.py` 是本地开发和 UI 联调用的轻量实现。
- `backend/app/modules/executions/service.py` 负责创建任务、取消任务、查询任务和持有 `CancellationToken`。
- `backend/app/modules/executions/runner.py` 负责串行消费任务队列、调用 `autotest.entry.run_case()`、转换框架事件并落盘。
- `backend/app/api/routes/executions.py` 提供任务 API 和执行 WebSocket。

当设置 `TESTFLOW_AUTOTEST_RUNTIME=real` 时，注册器会明确报错，表示真实框架尚未接入。

## 后端执行链路

创建任务：

1. 前端调用 `POST /api/tasks`，请求体为 `{"case_id": "<framework-case-id>"}`。
2. route 调用 `ExecutionService.create_task()`。
3. service 通过 `autotest.entry.get_case(case_id)` 读取用例展示信息。
4. service 创建 `ExecutionTask`、日志路径、报告目录和 `CancellationToken`。
5. runner 将任务放入串行队列。
6. worker 取出任务后构造 `FrameworkRunRequest`，调用 runtime 的 `run_case(request)`。

取消任务：

1. 前端调用 `POST /api/tasks/{task_id}/cancel`。
2. route 调用 `ExecutionService.cancel_task(task_id)`。
3. 如果任务不存在，返回 `404`。
4. 如果任务已经是 `passed`、`failed`、`canceled` 或 `error`，返回 `409 task_finished`。
5. 如果任务还在 `pending`，service 直接标记为 `canceled`，写入结束状态并发布事件。
6. 如果任务正在 `running`，service 调用 `CancellationToken.cancel()` 并写入 `Cancellation requested` 日志；真实 runtime 必须观察这个 token 并停止框架执行。

服务停止：

1. FastAPI shutdown 时调用 `ExecutionService.stop()`。
2. runner 对当前 active task 的 token 调用 `cancel()`。
3. runner 取消 worker task。
4. 当前任务会被标记为 `canceled`，并写入 `Execution canceled during shutdown` 日志。

## Runtime 协议

`RealAutotestRuntime` 必须实现：

```python
class AutotestRuntime(Protocol):
    def list_cases(self) -> list[FrameworkCaseSummary]: ...
    def get_case(self, case_id: str) -> FrameworkCaseSummary: ...
    def read_config(self) -> JsonValue: ...
    def write_config(self, config: JsonValue) -> JsonValue: ...
    def run_case(self, request: FrameworkRunRequest) -> AsyncIterator[FrameworkEvent]: ...
```

实现要求：

- `list_cases()` 返回可展示的框架用例列表。
- `get_case(case_id)` 找不到时抛 `FileNotFoundError(case_id)`。
- `read_config()` 返回 JSON 可序列化值。
- `write_config(config)` 写入后返回生效配置。
- `run_case(request)` 必须是异步事件流，持续 yield `FrameworkEvent`。
- 外部框架异常需要转换为 `run_error` 事件，或让 runner 捕获为任务 `error`；推荐显式转换，便于记录更清晰的错误信息。

## 用例目录接入

真实框架接入时先明确用例 ID 规则。`case_id` 是 TestFlow 和框架之间的稳定定位键，一旦历史任务保存后不应轻易改变。

建议规则：

- ID 来自框架原生稳定标识，例如模块路径、类名、方法名或框架 case key。
- 不使用展示名称作为 ID，因为展示名称可能被产品或测试人员修改。
- 如果框架没有稳定 ID，接入层生成 `suite.file.case` 这类可重复计算的 ID。

`FrameworkCaseSummary` 字段含义：

- `id`: 稳定用例 ID。
- `name`: 前端展示名称。
- `description`: 用例说明，没有则为空字符串。
- `tag`: 单个主标签，没有则为空字符串。
- `steps`: 用例步骤摘要，没有则为空 tuple。

## 配置接入

配置 API 对应：

- `GET /api/framework/config` -> `read_config()`。
- `PUT /api/framework/config` -> `write_config(config)`。

接入要求：

- 返回值必须能被 JSON 序列化。
- 不要返回框架内部对象、Path、datetime 或 SDK model。
- 不允许平台编辑的配置不要暴露在可写结构里。
- 写入前做 schema 校验，拒绝未知字段和类型错误。
- 框架配置文件不存在、权限不足、格式错误或 SDK 拒绝写入时，抛 `FrameworkConfigError`。

推荐错误码：

- `framework_config_unavailable`: 配置源不可用。
- `framework_config_invalid`: 请求配置不合法。
- `framework_config_read_failed`: 读取失败。
- `framework_config_write_failed`: 写入失败。

## 执行事件接入

`run_case(request)` 接收：

- `request.task_id`: TestFlow 任务 ID，用于关联日志和事件。
- `request.case_id`: 要执行的真实框架用例 ID。
- `request.report_dir`: 本次任务的报告目录。
- `request.cancellation_token`: 停止任务的协作式取消标记。

runtime 应该按以下顺序产出事件：

1. 执行开始后产出一条 `log`，说明真实框架已开始执行哪个用例。
2. 执行过程中持续把框架日志转换为 `FrameworkEvent(type="log")`。
3. 如果生成框架 HTML 报告或产物，可产出 `framework_report` 日志事件，报告文件写入 `request.report_dir`。
4. 正常结束时产出一个 `run_finished`，状态为 `passed` 或 `failed`。
5. 用户取消时产出一个 `run_finished(status="canceled")`。
6. 框架异常时产出 `run_error`，随后可结束生成器；runner 会把任务标为 `error`。

要求：

- 每个 `run_case()` 调用最终只能有一个终态：`passed`、`failed`、`canceled` 或 `error`。
- `run_finished` 后不要再产出日志。
- `task_id` 必须使用 `request.task_id`。
- 日志级别使用 `debug`、`info`、`warning` 或 `error`。

## 停止任务接入

真实 runtime 必须支持停止任务。TestFlow 的取消是协作式取消：平台负责设置 `request.cancellation_token.is_canceled=True`，runtime 负责把这个信号传递给真实框架并尽快返回。

### 任务状态行为

pending 任务：

- 任务尚未进入 runtime。
- `ExecutionService.cancel_task()` 会直接标记 `canceled`。
- runtime 不会收到这次任务的 `run_case()` 调用。

running 任务：

- `ExecutionService.cancel_task()` 设置 token，并写入 `Cancellation requested`。
- runtime 必须在执行循环、日志读取循环或等待框架结果时检查 token。
- runtime 收到取消后要停止真实框架执行，然后 yield `run_finished(status="canceled")` 并 return。

finished 任务：

- 已经终止的任务不能再次取消。
- API 返回 `409 task_finished`。
- runtime 不需要处理重复取消。

服务关闭中的任务：

- runner 会设置当前任务 token 并取消 worker。
- runtime 如果捕获到 `asyncio.CancelledError`，必须先尝试停止真实框架进程或会话，然后重新 raise，避免吞掉服务关闭信号。
- runner 会把任务标记为 `canceled`。

### 停止策略

如果真实框架提供 SDK 取消接口：

- 创建执行句柄后保存到当前 `run_case()` 的局部变量。
- token 变为 canceled 时调用 SDK 的 `cancel()`、`stop()` 或等价方法。
- 等待 SDK 返回最终结果时设置短超时，避免取消接口卡死。

如果真实框架通过子进程执行：

- 使用 `asyncio.create_subprocess_exec()` 启动。
- 并发读取 stdout/stderr，并转换为 `log` 事件。
- 循环等待进程退出时检查 token。
- token canceled 后先调用 `process.terminate()`。
- 在短暂 grace period 后仍未退出，再调用 `process.kill()`。
- 退出后 yield `run_finished(status="canceled")`。

如果真实框架是阻塞函数：

- 不要直接在 event loop 中调用阻塞函数。
- 放到线程或进程池中执行。
- 同时确认框架有可调用的停止句柄；如果没有，必须先在接入层补一个可停止包装，否则不能满足 TestFlow 的取消要求。

建议超时：

- 优雅停止等待 3 到 5 秒。
- 强制停止后再等待 1 到 2 秒收尾日志。
- 超时值可以后续移入配置，但不要先做复杂配置。

### 子进程取消骨架

```python
import asyncio
from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkRunRequest


async def run_process_case(
    request: FrameworkRunRequest,
    command: list[str],
) -> AsyncIterator[FrameworkEvent]:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    try:
        assert process.stdout is not None
        while True:
            if request.cancellation_token.is_canceled:
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()

                yield FrameworkEvent(
                    type="run_finished",
                    task_id=request.task_id,
                    status="canceled",
                )
                return

            line = await process.stdout.readline()
            if line:
                yield FrameworkEvent(
                    type="log",
                    task_id=request.task_id,
                    message=line.decode(errors="replace").rstrip(),
                    level="info",
                )
                continue

            if process.returncode is not None:
                break

            await asyncio.sleep(0.05)

        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed" if process.returncode == 0 else "failed",
        )
    except asyncio.CancelledError:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
        raise
```

### SDK 取消骨架

```python
from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkRunRequest


async def run_sdk_case(
    request: FrameworkRunRequest,
    client,
) -> AsyncIterator[FrameworkEvent]:
    handle = await client.start_case(request.case_id, report_dir=request.report_dir)

    try:
        async for message in handle.stream():
            if request.cancellation_token.is_canceled:
                await handle.cancel()
                yield FrameworkEvent(
                    type="run_finished",
                    task_id=request.task_id,
                    status="canceled",
                )
                return

            yield FrameworkEvent(
                type="log",
                task_id=request.task_id,
                message=message.text,
                level=message.level,
            )

        result = await handle.result()
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed" if result.passed else "failed",
        )
    except asyncio.CancelledError:
        await handle.cancel()
        raise
```

## 文件落点

新增真实 runtime：

- `backend/autotest/real_runtime.py`

修改注册器：

- `backend/autotest/registry.py`

推荐不要把真实框架 SDK 调用都堆在 `real_runtime.py`。如果逻辑变多，可以拆出：

- `backend/autotest/framework_client.py`: 封装框架 SDK 或进程调用。
- `backend/autotest/case_catalog.py`: 封装用例扫描和元数据解析。
- `backend/autotest/config_store.py`: 封装配置读写和校验。

这些文件仍属于 `backend/autotest/` 框架边界，不要新增到 `backend/app/` 顶层业务模块。

## 最小接入骨架

```python
from collections.abc import AsyncIterator

from autotest.contracts import (
    FrameworkCaseSummary,
    FrameworkConfigError,
    FrameworkEvent,
    FrameworkRunRequest,
    JsonValue,
)


class RealAutotestRuntime:
    def list_cases(self) -> list[FrameworkCaseSummary]:
        return []

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        raise FileNotFoundError(case_id)

    def read_config(self) -> JsonValue:
        raise FrameworkConfigError(
            code="framework_config_unavailable",
            message="Framework config is unavailable",
            status_code=503,
        )

    def write_config(self, config: JsonValue) -> JsonValue:
        return config

    async def run_case(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        yield FrameworkEvent(
            type="log",
            task_id=request.task_id,
            message=f"Running framework case: {request.case_id}",
            level="info",
        )

        if request.cancellation_token.is_canceled:
            yield FrameworkEvent(
                type="run_finished",
                task_id=request.task_id,
                status="canceled",
            )
            return

        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )
```

注册器接入：

```python
case "real":
    from autotest.real_runtime import RealAutotestRuntime

    return RealAutotestRuntime()
```

## 测试要求

后端测试至少覆盖：

- `TESTFLOW_AUTOTEST_RUNTIME=real` 能选择真实 runtime。
- `list_cases()` 返回真实框架用例目录。
- `get_case(case_id)` 找到用例。
- `get_case(missing)` 抛 `FileNotFoundError`，`POST /api/tasks` 返回 `404`。
- `read_config()` 和 `write_config()` 的成功路径。
- 配置读取失败、写入失败和配置不合法时转换为 `FrameworkConfigError`。
- 执行成功：runtime yield `log` 和 `run_finished(status="passed")`，任务最终为 `passed`。
- 执行失败：runtime yield `run_finished(status="failed")`，任务最终为 `failed`。
- 执行异常：runtime yield `run_error` 或抛异常，任务最终为 `error`。
- 取消 pending 任务：任务未进入 runtime，最终为 `canceled`。
- 取消 running 任务：`POST /api/tasks/{task_id}/cancel` 后 token 生效，真实框架停止，最终为 `canceled`。
- 服务 shutdown：当前运行中的真实框架进程或 SDK 句柄被停止，任务最终为 `canceled`。
- 取消已结束任务：API 返回 `409 task_finished`。
- 取消日志：任务日志包含 `Cancellation requested`。

建议在真实 runtime 测试中使用 fake framework client，不要依赖真实外部设备或长耗时环境。

修改后运行：

- `pnpm check:backend`
- `pnpm test:backend`
- 如影响前端展示，再运行 `pnpm check:web` 和 `pnpm --filter @testflow/web test`

## 验收标准

- mock 模式不依赖真实框架环境。
- real 模式只在真实框架依赖可用时启动。
- 后端 route 不知道具体框架 SDK，只通过 `AutotestRuntime` 协议交互。
- `POST /api/tasks/{task_id}/cancel` 能停止真实框架执行，而不只是把平台状态改成取消。
- 服务关闭时不会遗留真实框架进程、设备会话或后台线程。
- 每个任务都有明确终态，且终态能被历史记录和 WebSocket 观察到。
- 前端看到的用例、配置和执行事件格式保持稳定。
