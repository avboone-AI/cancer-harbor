import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
  width?: string
}

export default function DataTable<T extends { id: string }>({ rows, columns, empty = 'No records yet.' }: { rows: T[]; columns: Column<T>[]; empty?: string }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState(String(columns[0]?.key || ''))
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const visible = useMemo(() => {
    const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))
    return filtered.sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortKey] ?? '')
      const bv = String((b as Record<string, unknown>)[sortKey] ?? '')
      return av.localeCompare(bv, undefined, { numeric: true }) * (direction === 'asc' ? 1 : -1)
    })
  }, [rows, query, sortKey, direction])

  const toggleSort = (key: string) => {
    if (key === sortKey) setDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setDirection('asc') }
  }

  return <div className="table-card">
    <div className="table-tools">
      <label className="search-box"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this table"/></label>
      <span>{visible.length} record{visible.length === 1 ? '' : 's'}</span>
    </div>
    <div className="table-scroll">
      <table>
        <thead><tr>{columns.map((column) => <th key={String(column.key)} style={{ minWidth: column.width }} onClick={() => toggleSort(String(column.key))}>
          <span>{column.label}{sortKey === column.key && (direction === 'asc' ? <ArrowUp size={13}/> : <ArrowDown size={13}/>)}</span>
        </th>)}</tr></thead>
        <tbody>{visible.length ? visible.map((row) => <tr key={row.id}>{columns.map((column) => <td key={String(column.key)}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? '—')}</td>)}</tr>) : <tr><td colSpan={columns.length} className="empty-cell">{empty}</td></tr>}</tbody>
      </table>
    </div>
  </div>
}
