import type { TestScript } from '@/lib/api'

export const emptyScript: TestScript = {
  id: '',
  name: '',
  description: '',
  status: 'draft',
  tags: [],
  group: '',
  variables: [],
  steps: [],
}
