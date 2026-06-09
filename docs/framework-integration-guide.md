# 真实测试框架接入指南

本文档说明如何把 TestFlow 当前的 mock 自动化运行时替换为真实测试框架。`real_runtime.py` 不保留占位实现；只有在明确接入具体框架时再新增。

## 当前边界

- 后端通过 `backend/autotest/runtime.py` 定义 `AutotestRuntime` 协议。
- `backend/autotest/entry.py` 是业务入口，负责把用例列表、配置读写和执行请求委托给当前 runtime。
- `backend/autotest/registry.py` 根据 `TESTFLOW_AUTOTEST_RUNTIME` 选择 runtime；当前只可用 `mock`。
- `backend/autotest/mock_runtime.py` 是本地开发和 UI 联调用的轻量实现。

当设置 `TESTFLOW_AUTOTEST_RUNTIME=real` 时，注册器会明确报错，表示真实框架尚未接入。

## 接入步骤

1. 明确真实框架能力和数据格式：
   - 用例清单来源：配置文件、框架 API、数据库或扫描目录。
   - 用例 ID 稳定规则：ID 必须可重复定位同一个框架用例。
   - 配置读写边界：确定哪些配置允许 TestFlow 修改，哪些只读。
   - 执行事件：至少需要输出日志事件和最终状态事件。

2. 新增 `backend/autotest/real_runtime.py`：
   - 实现 `RealAutotestRuntime` 类。
   - 方法签名遵守 `AutotestRuntime` 协议。
   - 对外部框架异常做归一化，不把第三方异常直接穿透到 route 层。

3. 接入注册器：
   - 在 `backend/autotest/registry.py` 的 `"real"` 分支导入并返回 `RealAutotestRuntime()`。
   - 保持 lazy import，避免 mock 模式启动时强依赖真实框架环境。

4. 补齐用例目录能力：
   - `list_cases()` 返回 `FrameworkCaseSummary` 列表。
   - `get_case(case_id)` 找不到时抛 `FileNotFoundError(case_id)`。
   - 用例的 `steps`、`tag`、`description` 可来自真实框架元数据；没有时返回空值。

5. 补齐配置能力：
   - `read_config()` 返回 JSON 可序列化值。
   - `write_config(config)` 写入后返回生效配置。
   - 配置不可用、格式不合法或外部框架拒绝时，抛 `FrameworkConfigError`，并设置稳定的 `code` 和合适的 HTTP `status_code`。

6. 补齐执行能力：
   - `run_case(request)` 返回 `AsyncIterator[FrameworkEvent]`。
   - 执行过程中持续产出 `log` 事件。
   - 结束时必须产出一个 `run_finished` 事件，状态为 `passed`、`failed`、`canceled` 或 `error`。
   - 检查 `request.cancellation_token.is_canceled`，尽快停止真实框架任务或标记取消。
   - 如生成报告，将报告写入 `request.report_dir` 指向的目录，并通过既有报告链路暴露。

## 最小代码骨架

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
        yield FrameworkEvent(
            type="run_finished",
            task_id=request.task_id,
            status="passed",
        )
```

## 测试要求

- 为 `registry.py` 增加 `TESTFLOW_AUTOTEST_RUNTIME=real` 的选择测试。
- 为真实 runtime 增加用例清单、用例详情、配置读写和执行事件测试。
- 执行路径至少覆盖成功、失败、取消和外部框架异常。
- 修改后运行：
  - `pnpm check:backend`
  - 如影响前端展示，再运行 `pnpm check:web` 和 `pnpm --filter @testflow/web test`

## 验收标准

- mock 模式不依赖真实框架环境。
- real 模式只在真实框架依赖可用时启动。
- 后端 route 不知道具体框架 SDK，只通过 `AutotestRuntime` 协议交互。
- 前端看到的用例、配置和执行事件格式保持稳定。
