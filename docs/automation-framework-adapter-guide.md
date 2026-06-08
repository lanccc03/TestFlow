# 自动化框架适配指南

本文面向需要把真实自动化框架接入 TestFlow 的开发者。目标是实现一个
`AutotestRuntime`，让 TestFlow 可以在不修改执行服务、关键字接口和前端的情况下，
从当前 mock runtime 切换到 real runtime。

## 适配边界

TestFlow 的自动化框架边界位于 `backend/autotest/`。

```text
FastAPI routes
  -> app.modules.executions.service
    -> app.modules.executions.runner
      -> autotest.entry
        -> autotest.registry
          -> mock runtime / real runtime
```

上层业务只允许依赖 `autotest.entry`：

- `autotest.entry.list_keywords()`：返回可用关键字定义。
- `autotest.entry.list_cases()`：返回测试框架可执行用例的只读目录。
- `autotest.entry.get_case(case_id)`：按框架用例 ID/引用读取名称、描述和测试步骤。
- `autotest.entry.run_script(request)`：执行脚本并流式返回框架事件。

真实框架的 SDK、CLI、配置对象、结果对象和异常类型都应封装在
`backend/autotest/real_runtime.py` 内，不要泄漏到 `app.modules.*`、API schema、
数据库模型或前端。

## 需要实现的接口

运行时协议定义在 `backend/autotest/runtime.py`：

```python
from collections.abc import AsyncIterator
from typing import Protocol

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest


class AutotestRuntime(Protocol):
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        ...

    def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        ...
```

真实框架适配时，主要修改 `backend/autotest/real_runtime.py`：

```python
from collections.abc import AsyncIterator

from autotest.contracts import FrameworkEvent, FrameworkKeywordDef, FrameworkRunRequest


class RealAutotestRuntime:
    def list_keywords(self) -> list[FrameworkKeywordDef]:
        return load_real_framework_keywords()

    async def run_script(
        self,
        request: FrameworkRunRequest,
    ) -> AsyncIterator[FrameworkEvent]:
        yield FrameworkEvent(type="run_started", task_id=request.task_id)
        ...
```

如真实框架只能同步执行，可以在 `run_script()` 中用线程池或进程适配，但对 TestFlow
仍然必须暴露 `AsyncIterator[FrameworkEvent]`。

## 配置切换

配置字段位于 `backend/app/core/config.py`：

```python
autotest_runtime: str = "mock"
```

默认使用 mock runtime。切换真实框架：

```powershell
$env:TESTFLOW_AUTOTEST_RUNTIME = "real"
pnpm dev:backend
```

非法值会在 `autotest.registry.get_runtime()` 抛出明确错误：

```text
Unknown autotest runtime: <value>
```

## 框架配置适配

TestFlow 提供框架配置读写接口，但不直接管理真实配置文件路径。配置仍然属于自动化
框架，由 runtime 通过 `backend/autotest/entry.py` 暴露给上层：

```text
FastAPI routes
  -> autotest.entry.read_config() / write_config(config)
    -> autotest.registry.get_runtime()
      -> runtime.read_config() / write_config(config)
```

公开 API：

```text
GET /api/framework/config
PUT /api/framework/config
```

`GET` 返回当前框架配置的完整 JSON；`PUT` 接收整份 JSON 配置并完整替换，返回 runtime
保存后的 JSON。请求体不要包一层 `config` 字段，例如：

```json
{
  "environment": {
    "name": "dev",
    "base_url": "http://127.0.0.1"
  },
  "devices": [
    {
      "name": "bench-1",
      "host": "192.168.1.10"
    }
  ],
  "variables": {
    "retries": 2,
    "dry_run": false
  }
}
```

后端只要求请求体是合法 JSON，不理解、不裁剪、不补默认字段。JSON 根值可以是对象、
数组、字符串、数字、布尔值或 `null`；真实框架是否接受这些形态由 runtime 决定。

runtime 协议需要实现：

```python
from autotest.contracts import JsonValue


class RealAutotestRuntime:
    def read_config(self) -> JsonValue:
        return load_real_framework_config()

    def write_config(self, config: JsonValue) -> JsonValue:
        return save_real_framework_config(config)
```

适配建议：

- 在 `real_runtime.py` 内定位、读取和写入真实框架自己的 JSON 配置文件。
- 如果框架配置不存在，可以按真实框架语义创建、返回默认值或抛出错误；TestFlow 不强制。
- 如果配置不可读、不可写或 runtime 尚未实现，抛出 `FrameworkConfigError`，API 会转换为统一
  error envelope。
- 不要在 FastAPI route、`app.modules.*` 或前端里硬编码真实框架配置路径。
- 不要让 TestFlow 维护一份与真实框架分离的设备、环境或变量配置副本。

错误示例：

```python
from autotest.contracts import FrameworkConfigError


raise FrameworkConfigError(
    code="framework_config_unavailable",
    message="Framework config is unavailable",
    status_code=501,
    details={"reason": "real runtime is not implemented"},
)
```

API 响应：

```json
{
  "error": {
    "code": "framework_config_unavailable",
    "message": "Framework config is unavailable",
    "details": {
      "reason": "real runtime is not implemented"
    }
  }
}
```

## 框架用例目录

TestFlow 不再维护自己的 YAML 脚本。用例目录来自自动化框架 runtime：

```text
GET /api/scripts
GET /api/scripts/{script_id}
```

runtime 需要返回 `FrameworkCaseSummary`：

```python
FrameworkCaseSummary(
    id="case.smoke_cockpit",
    name="座舱冒烟测试",
    description="基础稳定性巡检",
    steps=("启动系统", "确认首页加载", "检查关键状态正常"),
)
```

真实框架如果在脚本注释中维护用例名称、描述和测试步骤，应在
`RealAutotestRuntime.list_cases()` / `get_case()` 内解析注释。不要让
`app.modules.*` 或前端解析框架脚本文件。

## 请求契约

`FrameworkRunRequest` 是 TestFlow 传给自动化框架的标准输入。

字段说明：

| 字段 | 含义 | 适配建议 |
| --- | --- | --- |
| `task_id` | TestFlow 执行任务 ID | 原样带入所有事件 |
| `script_id` | 脚本 ID | 用于报告、日志和框架 trace |
| `script_name` | 脚本名称 | 可映射为框架 suite/case 名称 |
| `script_revision` | 脚本版本 | 写入框架报告或上下文 |
| `steps` | TestFlow 自维护步骤；执行框架原生用例时可以为空 |
| `variables` | 脚本变量 | 注入框架上下文 |
| `environment` | 环境信息 | 连接环境、运行配置或 profile |
| `target_device` | 目标设备 | 设备、浏览器、主机或被测对象信息 |
| `log_path` | TestFlow 日志路径 | 可追加框架原始日志 |
| `report_dir` | TestFlow 任务报告目录 | 平台分配的任务目录；框架 HTML 报告不要求写入这里 |
| `artifact_dir` | TestFlow 附件目录 | 可存放普通截图、trace、视频等附件；框架自有报告目录可独立存在 |
| `cancellation_token` | 取消令牌 | 在步骤前、等待中和长操作间隙轮询 |

`FrameworkStep` 字段：

| 字段 | 含义 |
| --- | --- |
| `id` | TestFlow 步骤 ID，事件必须带回 |
| `index` | 步骤序号，事件必须带回 |
| `keyword` | 关键字名称，如 `wait`、`log.message` |
| `description` | 步骤说明 |
| `enabled` | 是否启用 |
| `params` | 关键字参数 |

## 事件契约

`run_script()` 必须按事件流返回 `FrameworkEvent`。执行层会根据事件更新任务状态、
步骤状态、日志、附件和报告。

支持事件类型：

| 事件 | 何时发出 | 必填字段 |
| --- | --- | --- |
| `run_started` | 脚本开始执行 | `task_id` |
| `step_started` | 单个步骤开始 | `task_id`, `step_id`, `step_index`, `keyword` |
| `log` | 框架日志或步骤日志 | `task_id`, `message`, `level` |
| `step_finished` | 单个步骤结束 | `task_id`, `step_id`, `step_index`, `keyword`, `status` |
| `attachment` | 产生截图、trace、日志包等普通附件 | `task_id`, `attachment_path` |
| `run_finished` | 脚本正常结束、失败或取消 | `task_id`, `status` |
| `framework_report` | 框架生成 HTML 报告入口 | `task_id`, `report_kind`, `report_source`, `report_entry` |
| `run_error` | 框架基础设施异常 | `task_id`, `error_message` |

`framework_report` 字段：

| 字段 | 含义 | 适配建议 |
| --- | --- | --- |
| `report_kind` | 报告类型 | 当前只支持 `"html"` |
| `report_source` | 报告来源 | 本地文件用 `"file"`；外部可访问地址用 `"url"` |
| `report_root_dir` | 本地 HTML 报告根目录 | `report_source="file"` 时建议必填，指向框架生成报告的目录 |
| `report_entry` | 报告入口 | 本地文件可用绝对路径或相对 `report_root_dir` 的路径；URL 报告填完整 URL |
| `report_title` | 前端显示标题 | 可选，默认显示为“框架报告” |

状态值：

| 状态 | 使用场景 |
| --- | --- |
| `passed` | 步骤或脚本成功 |
| `failed` | 脚本执行成功完成，但业务断言或关键字失败 |
| `canceled` | 用户取消或服务关闭导致执行停止 |
| `error` | 框架启动、连接、适配器或基础设施异常 |

建议事件顺序：

```text
run_started
step_started
log*
attachment*
step_finished
...
framework_report?
run_finished
```

执行框架原生用例时，最小事件流可以只有 `run_started`、`log*`、`framework_report?` 和
`run_finished`。`step_started` / `step_finished` 仅在 runtime 能自然提供逐步骤状态时使用。

失败步骤建议：

```text
run_started
step_started
log(level="error")
step_finished(status="failed", error_message=...)
run_finished(status="failed")
```

基础设施异常建议：

```text
run_started
run_error(error_message=..., error_detail=...)
run_finished(status="error")
```

## 关键字发现

`list_keywords()` 是 TestFlow 关键字库的来源。真实框架接入后，应从真实框架能力中
生成 `FrameworkKeywordDef`。

示例：

```python
FrameworkKeywordDef(
    name="device.click",
    description="点击目标设备上的元素",
    module="device",
    parameters=(
        FrameworkKeywordParam(
            name="selector",
            description="目标元素选择器",
            type="string",
            required=True,
            example="#submit",
        ),
    ),
    example={"selector": "#submit"},
    enabled=True,
)
```

要求：

- `name` 必须稳定，脚本保存后不应随意改名。
- `parameters` 应使用 `string`、`integer`、`number`、`boolean`、`object`、`array`。
- 无法执行或暂未开放的关键字可以返回 `enabled=False`，让前端可见但不可选。
- `list_keywords()` 返回新列表，调用方修改返回值不应污染 runtime 内部缓存。

## 步骤执行规则

真实 runtime 应按 `request.steps` 顺序执行启用步骤。

建议规则：

1. 执行前先检查 `request.cancellation_token.is_canceled`。
2. 跳过 `enabled=False` 的步骤。
3. 每个执行步骤先发 `step_started`。
4. 将 `step.keyword` 和 `step.params` 转成真实框架调用。
5. 框架日志转成 `log` 事件。
6. 普通框架附件可写入 `request.artifact_dir`，再发 `attachment` 事件。
7. 步骤成功发 `step_finished(status="passed", output=...)`。
8. 步骤业务失败发 `step_finished(status="failed", error_message=...)`，随后
   `run_finished(status="failed")`。
9. 用户取消发 `step_finished(status="canceled")` 和 `run_finished(status="canceled")`。
10. 基础设施异常发 `run_error`，随后 `run_finished(status="error")`。
11. 如果框架生成了 HTML 报告，在 `run_finished` 前发 `framework_report` 事件。

`output` 必须是可 JSON 序列化的 `dict[str, Any]`。不要放入框架对象、文件句柄、
数据库连接或异常对象。

## 取消处理

TestFlow 取消请求通过 `CancellationToken` 传入。真实 runtime 要合作式响应取消。

必须检查取消的位置：

- 脚本启动前。
- 每个步骤开始前。
- 长时间等待、轮询、远程调用或设备操作期间。
- 每个步骤完成后、进入下一个步骤前。

如果真实框架有自己的取消 API，适配器应在发现 `is_canceled` 后调用它，并把最终状态
映射为 `canceled`。不要把用户取消映射为 `failed` 或 `error`。

如果 Python asyncio task 被直接取消，应让 `asyncio.CancelledError` 继续传播。现有
测试会检查这一点，避免服务关闭时被适配器吞掉取消信号。

## 错误映射

区分业务失败和基础设施异常。

业务失败示例：

- 断言失败。
- 关键字参数不合法。
- 元素未找到且该关键字语义是失败。
- 被测系统返回不符合预期。

映射为：

```python
FrameworkEvent(
    type="step_finished",
    task_id=request.task_id,
    step_id=step.id,
    step_index=step.index,
    keyword=step.keyword,
    status="failed",
    error_message="...",
    error_detail={...},
)
```

基础设施异常示例：

- 框架进程启动失败。
- SDK 初始化失败。
- 无法连接设备池、执行机或远程服务。
- 适配器自身出现未预期异常。

映射为：

```python
FrameworkEvent(
    type="run_error",
    task_id=request.task_id,
    error_message="...",
    error_detail={...},
)
FrameworkEvent(
    type="run_finished",
    task_id=request.task_id,
    status="error",
)
```

## 附件和报告

框架自己的 HTML 报告应保留在框架报告目录中，不要复制到 TestFlow 的 `data/`
目录，也不要让 TestFlow 重新生成一份报告详情。真实 runtime 在拿到报告入口后发出
`framework_report` 事件：

```python
FrameworkEvent(
    type="framework_report",
    task_id=request.task_id,
    report_kind="html",
    report_source="file",
    report_root_dir=framework_report_dir,
    report_entry=framework_report_dir / "index.html",
    report_title="自动化框架报告",
)
```

`report_root_dir` 是框架生成报告的根目录，`report_entry` 是 HTML 入口文件。
`report_entry` 可以是绝对路径，也可以是相对 `report_root_dir` 的路径。为了让报告内的
CSS、JS、图片等相对资源可访问，建议始终传入稳定的 `report_root_dir`。

TestFlow 会保存这个入口，并通过报告详情页优先展示框架 HTML 报告。对于
`report_source="file"` 的本地报告，后端提供：

```text
GET /api/reports/{task_id}/framework-report
GET /api/reports/{task_id}/framework-report/{asset_path}
```

第一个接口返回 HTML 入口文件，第二个接口只允许读取 `report_root_dir` 下面的相对资源。
后端会解析真实路径，拒绝越过 `report_root_dir` 的访问；路径逃逸返回 `403`，文件缺失返回
`404`。如果 `report_source="url"`，前端直接打开 `report_entry`。

TestFlow 仍会保存任务快照、步骤状态、日志和附件索引作为兜底详情；如果没有
`framework_report`，报告详情页会显示这些平台结构化信息。TestFlow 不再生成
`testflow-report.json` 作为报告详情文件。

普通截图、trace、日志压缩包等仍然使用 `attachment` 事件：

```python
FrameworkEvent(
    type="attachment",
    task_id=request.task_id,
    step_id=step.id,
    step_index=step.index,
    keyword=step.keyword,
    attachment_path=artifact_path,
    attachment_name="step-1-screenshot.png",
)
```

`attachment_path` 可以是 `Path` 或字符串。普通附件建议写入 `request.artifact_dir`，
或使用后端可稳定访问的绝对路径；HTML 报告入口不要通过 `attachment` 表达。

## 最小接入步骤

1. 在 `backend/autotest/real_runtime.py` 中实现 `RealAutotestRuntime`。
2. 实现 `list_keywords()`，先返回真实框架可执行的最小关键字集合。
3. 实现 `run_script()` 的事件流骨架：`run_started`、步骤事件、`run_finished`。
4. 增加关键字调用分发，把 `FrameworkStep` 转成真实框架调用。
5. 接入取消检查。
6. 接入错误映射。
7. 普通附件发 `attachment` 事件。
8. 框架 HTML 报告生成完成后发 `framework_report` 事件，报告文件保留在框架目录。
9. 设置 `TESTFLOW_AUTOTEST_RUNTIME=real` 后运行测试和手工 smoke。

## 测试要求

优先新增或扩展这些测试：

- `backend/tests/test_autotest_runtime_registry.py`
  - 验证 `real` 配置能选择 `RealAutotestRuntime`。
  - 验证非法配置有明确错误。
- `backend/tests/test_autotest_adapter.py`
  - 验证真实 runtime 的成功事件顺序。
  - 验证步骤失败会返回 `failed`。
  - 验证取消会返回 `canceled`。
  - 验证基础设施异常会返回 `run_error` 和 `error`。
  - 验证附件事件能被执行层记录。
  - 验证事件契约包含 `framework_report`。
- `backend/tests/test_execution_service.py`
  - 使用 fake runtime 覆盖执行服务对事件的处理，不依赖真实外部系统。
  - 验证 `framework_report` 事件能记录到任务和报告详情。
- `backend/tests/test_execution_history.py`
  - 验证框架 HTML 报告入口可持久化。
  - 验证 `/api/reports/{task_id}/framework-report` 能返回入口 HTML。
  - 验证报告内相对资源只能从 `report_root_dir` 下读取。
  - 验证 TestFlow 不生成 `testflow-report.json` 作为报告详情。

基础验证命令：

```powershell
pnpm check:backend
pnpm test:backend
```

真实框架接入后，建议额外提供一组可选集成测试，例如：

```powershell
$env:TESTFLOW_AUTOTEST_RUNTIME = "real"
$env:TESTFLOW_REAL_AUTOTEST_INTEGRATION = "1"
cd backend
uv run pytest tests/test_real_autotest_runtime.py
```

不要让真实外部依赖测试默认阻塞普通 `pnpm test:backend`。

## 接入完成检查清单

- [ ] `RealAutotestRuntime` 实现了 `list_keywords()`。
- [ ] `RealAutotestRuntime` 实现了 `run_script()` 并返回 `AsyncIterator[FrameworkEvent]`。
- [ ] 所有事件都带 `task_id`。
- [ ] 步骤事件都带 `step_id`、`step_index`、`keyword`。
- [ ] 成功路径最终发出 `run_finished(status="passed")`。
- [ ] 业务失败映射为 `failed`，不是 `error`。
- [ ] 基础设施异常映射为 `run_error` 和 `run_finished(status="error")`。
- [ ] 用户取消映射为 `canceled`。
- [ ] `asyncio.CancelledError` 不被吞掉。
- [ ] `output`、`error_detail` 可 JSON 序列化。
- [ ] 普通附件写入稳定路径，并发出 `attachment` 事件。
- [ ] HTML 报告保留在框架报告目录中，不复制到 TestFlow `data/` 目录。
- [ ] HTML 报告生成后发出 `framework_report` 事件。
- [ ] `framework_report` 使用 `report_kind="html"` 和正确的 `report_source`。
- [ ] 本地 HTML 报告提供有效的 `report_root_dir` 和 `report_entry`。
- [ ] `/api/reports/{task_id}/framework-report` 可以打开框架 HTML 报告。
- [ ] `TESTFLOW_AUTOTEST_RUNTIME=real` 可以启动后端。
- [ ] `pnpm check:backend` 通过。
- [ ] `pnpm test:backend` 通过。

## 不要做的事

- 不要让 `app.modules.executions` 直接 import 真实框架 SDK。
- 不要在 runtime 内写 TestFlow 数据库记录。
- 不要在 runtime 内发布 WebSocket 消息。
- 不要把真实框架对象直接塞进 `FrameworkEvent.output`。
- 不要把用户取消当成失败。
- 不要为了某个具体真实框架再修改前端 API schema；使用现有 `framework_report` 契约。
- 不要把框架 HTML 报告复制到 `data/reports/`。
- 不要让 runtime 生成 TestFlow 自己的 `testflow-report.json`。
- 不要让默认测试依赖真实设备、远程服务或私有凭据。
