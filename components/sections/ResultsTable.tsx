import type { ResultsTable as ResultsTableType } from '@/types';

interface ResultsTableProps {
  table: ResultsTableType;
}

export default function ResultsTable({ table }: ResultsTableProps) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-2">
            Tabulka
          </h2>
          <p className="text-gray-600">
            {table.competition} - Sezóna {table.season}
          </p>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tým</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Z</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">V</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">R</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">P</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">VG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">OG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Skóre</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {table.rows.map((row) => (
                  <tr
                    key={row.position}
                    className={`hover:bg-gray-50 transition-colors ${
                      row.isHomeTeam ? 'bg-secondary/5 font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{row.position}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {row.team}
                      {row.isHomeTeam && (
                        <span className="ml-2 text-xs bg-secondary text-white px-2 py-0.5 rounded">
                          FM
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.matchesPlayed}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.wins}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.draws}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.losses}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.goalsFor}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.goalsAgainst}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {row.goalDifference > 0 && '+'}
                      {row.goalDifference}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-primary text-center">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Table */}
        <div className="md:hidden space-y-4">
          {table.rows.map((row) => (
            <div
              key={row.position}
              className={`bg-white rounded-lg shadow p-4 ${
                row.isHomeTeam ? 'border-2 border-secondary' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-400">
                    {row.position}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">{row.team}</p>
                    {row.isHomeTeam && (
                      <span className="text-xs bg-secondary text-white px-2 py-0.5 rounded">
                        Frýdek-Místek
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">{row.points}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm text-gray-600">
                <div className="text-center">
                  <div className="text-xs text-gray-400">Zápasy</div>
                  <div className="font-semibold">{row.matchesPlayed}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">V-R-P</div>
                  <div className="font-semibold">
                    {row.wins}-{row.draws}-{row.losses}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Skóre</div>
                  <div className="font-semibold">
                    {row.goalsFor}:{row.goalsAgainst}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Poslední aktualizace:{' '}
          {new Date(table.lastUpdated).toLocaleDateString('cs-CZ', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </section>
  );
}
