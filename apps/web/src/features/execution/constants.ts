import { backendBaseUrl } from '@/app/config'

export const executionWebSocketUrl = backendBaseUrl.replace('http://', 'ws://') + '/ws/executions'
