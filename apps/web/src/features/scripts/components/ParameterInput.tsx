import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { KeywordParameter } from '@/lib/api'

export function ParameterInput({
  onChange,
  parameter,
  value,
}: {
  onChange: (value: string | boolean) => void
  parameter: KeywordParameter
  value: unknown
}) {
  if (parameter.type === 'boolean') {
    return (
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {parameter.description || parameter.name}
        </span>
        <Checkbox
          aria-label={`参数 ${parameter.name}`}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      </label>
    )
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {parameter.description || parameter.name}
      </span>
      <Input
        aria-label={`参数 ${parameter.name}`}
        type={
          parameter.type === 'integer' || parameter.type === 'number'
            ? 'number'
            : 'text'
        }
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
