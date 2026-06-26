import { ListFilter, ChevronUp, ChevronDown } from 'lucide-react'

const LETTERS = 'ABCDEFGHIJKL'.split('')

// Generic Google-Sheets-style grid. `columns` is an array of:
//   { key, label, className?, sortable?, render(row), sortValue?(row) }
export default function SheetTable({ columns, rows, onRowClick, sortKey, sortDir, onSort }) {
  return (
    <div className="gsheet-wrap">
      <table className="gsheet">
        <thead>
          <tr className="gs-letters">
            <th aria-hidden />
            {columns.map((c, i) => (
              <th key={c.key}>{LETTERS[i]}</th>
            ))}
          </tr>
          <tr className="gs-head">
            <th className="gs-gutter" aria-hidden />
            {columns.map((c) => {
              const sortable = c.sortable !== false
              const active = sortKey === c.key
              return (
                <th
                  key={c.key}
                  onClick={sortable ? () => onSort(c.key) : undefined}
                  style={{ cursor: sortable ? 'pointer' : 'default' }}
                >
                  {c.label}
                  {active ? (
                    sortDir === 'asc' ? (
                      <ChevronUp className="gs-funnel" size={13} />
                    ) : (
                      <ChevronDown className="gs-funnel" size={13} />
                    )
                  ) : (
                    sortable && <ListFilter className="gs-funnel" size={13} />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className={row.blockers?.length ? 'gs-row-flag' : ''}
              onClick={() => onRowClick(row.id)}
            >
              <td className="gs-gutter">{i + 2}</td>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
