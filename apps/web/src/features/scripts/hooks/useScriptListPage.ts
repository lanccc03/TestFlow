import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/app/backend'

export function useScriptListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: api.listCases,
  })
  const executeMutation = useMutation({
    mutationFn: (caseId: string) => api.createTask({ case_id: caseId }),
    onSuccess: (task) => {
      navigate(`/tasks?taskId=${encodeURIComponent(task.id)}`)
    },
  })

  const cases = casesQuery.data?.items ?? []
  const query = search.trim().toLowerCase()
  const filteredCases = query
    ? cases.filter((caseItem) =>
        [caseItem.id, caseItem.name, caseItem.description, ...caseItem.test_steps]
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
    : cases

  return {
    executeMutation,
    filteredCases,
    search,
    cases,
    casesQuery,
    setSearch,
  }
}
