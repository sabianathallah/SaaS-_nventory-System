import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { setAxiosCompanyScope } from '../api/axios'
import { companiesApi } from '../api'
import { useAuth } from './AuthContext'

const SelectedCompanyContext = createContext(null)

function readSession() {
  try { return JSON.parse(localStorage.getItem('selectedCompany')) ?? null }
  catch { return null }
}

export function SelectedCompanyProvider({ children }) {
  const { isSuperAdmin } = useAuth()
  const [selectedCompany, setSelectedCompanyState] = useState(() => {
    const company = readSession()
    setAxiosCompanyScope(company?.id ?? null) // set synchronously before first render
    return company
  })

  // Keep in sync if localStorage changes externally (e.g. other tabs)
  useEffect(() => {
    setAxiosCompanyScope(selectedCompany?.id ?? null)
  }, [selectedCompany])

  // Guard against a stale/invalid company lingering in localStorage (e.g. a
  // company that was deleted or recreated with a different id) — a stale id
  // silently scopes every request to a company that doesn't exist, making
  // CRUD lists look empty without any error. Drop it back to "all companies".
  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn:  () => companiesApi.list({ limit: 100 }),
    enabled:  isSuperAdmin && !!selectedCompany,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!selectedCompany || !companiesData) return
    const stillValid = companiesData.data?.some(c => c.id === selectedCompany.id)
    if (!stillValid) setSelectedCompany(null)
  }, [companiesData, selectedCompany])

  const setSelectedCompany = (company) => {
    setSelectedCompanyState(company)
    setAxiosCompanyScope(company?.id ?? null)
    if (company) localStorage.setItem('selectedCompany', JSON.stringify(company))
    else localStorage.removeItem('selectedCompany')
  }

  return (
    <SelectedCompanyContext.Provider value={{ selectedCompany, setSelectedCompany }}>
      {children}
    </SelectedCompanyContext.Provider>
  )
}

export const useSelectedCompany = () => useContext(SelectedCompanyContext)
