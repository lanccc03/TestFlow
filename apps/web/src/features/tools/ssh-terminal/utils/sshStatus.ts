export function sshStatusLabel(status: string) {
  if (status === 'connected') return '已连接'
  if (status === 'connecting') return '连接中'
  if (status === 'error') return '异常'
  return '已断开'
}
