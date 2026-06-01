import {
  Activity,
  Clock3,
  FileCode2,
  FileText,
  FolderKanban,
  History,
  Library,
  Network,
  SendToBack,
  SquareTerminal,
} from 'lucide-react'
import type React from 'react'

import { EmptyState, PageHeader, PagePanel } from '@/components/layout/page'
import { TaskPage } from '@/features/execution/TaskPage'
import { ScriptEditorPage, ScriptListPage } from '@/features/scripts/ScriptPages'
import { CommandLibraryPage, SshTerminalPage } from '@/features/tools/ToolPages'

export type AppRoute = {
  path: string
  label: string
  description: string
  navGroup: 'scripts' | 'execution' | 'tools'
  icon: typeof FolderKanban
  element: React.ReactNode
  navHidden?: boolean
}

const upcomingLabel = '等待后续阶段接入数据'

function PlaceholderPage({
  action,
  description,
  title,
}: {
  action: string
  description: string
  title: string
}) {
  return (
    <PagePanel>
      <PageHeader
        eyebrow={upcomingLabel}
        title={title}
        subtitle={description}
      />
      <EmptyState
        icon={<FileCode2 aria-hidden="true" />}
        title={action}
        description="阶段三先提供稳定路由、布局和状态框架；业务表单、执行器和报告数据会在后续阶段逐步接入。"
      />
    </PagePanel>
  )
}

export const appRoutes: AppRoute[] = [
  {
    path: '/scripts',
    label: '脚本管理',
    description: '管理 YAML 测试脚本列表、搜索和入口操作。',
    navGroup: 'scripts',
    icon: FolderKanban,
    element: <ScriptListPage />,
  },
  {
    path: '/scripts/new',
    label: '脚本编辑器',
    description: '通过关键字和参数表单编辑测试脚本。',
    navGroup: 'scripts',
    icon: FileCode2,
    element: <ScriptEditorPage />,
  },
  {
    path: '/scripts/:scriptId',
    label: '脚本详情',
    description: '编辑已有 YAML 测试脚本。',
    navGroup: 'scripts',
    icon: FileCode2,
    element: <ScriptEditorPage />,
    navHidden: true,
  },
  {
    path: '/tasks',
    label: '执行任务',
    description: '发起单脚本执行并查看实时进度。',
    navGroup: 'execution',
    icon: Activity,
    element: <TaskPage />,
  },
  {
    path: '/history',
    label: '执行历史',
    description: '查看历史任务、结果和执行日志入口。',
    navGroup: 'execution',
    icon: History,
    element: (
      <PlaceholderPage
        title="执行历史"
        description="按时间查看测试任务结果和失败摘要。"
        action="历史记录将在数据库模型完成后显示"
      />
    ),
  },
  {
    path: '/reports',
    label: '报告详情',
    description: '展示执行报告、步骤结果和日志片段。',
    navGroup: 'execution',
    icon: FileText,
    element: (
      <PlaceholderPage
        title="报告详情"
        description="查看报告摘要、步骤状态和原始执行输出。"
        action="报告视图将在阶段七接入"
      />
    ),
  },
  {
    path: '/ssh',
    label: 'SSH 终端',
    description: '连接测试设备并运行辅助命令。',
    navGroup: 'tools',
    icon: SquareTerminal,
    element: <SshTerminalPage />,
  },
  {
    path: '/scp',
    label: 'SCP 文件传输',
    description: '在本机和测试设备之间传输文件。',
    navGroup: 'tools',
    icon: SendToBack,
    element: (
      <PlaceholderPage
        title="SCP 文件传输"
        description="上传脚本依赖、下载日志和报告附件。"
        action="文件传输将在阶段八接入"
      />
    ),
  },
  {
    path: '/commands',
    label: '命令库',
    description: '维护可复用 SSH 命令和测试辅助命令。',
    navGroup: 'tools',
    icon: Library,
    element: <CommandLibraryPage />,
  },
]

export const navGroups = [
  { id: 'scripts', label: '脚本', icon: FileCode2 },
  { id: 'execution', label: '执行', icon: Clock3 },
  { id: 'tools', label: '工具', icon: Network },
] as const
