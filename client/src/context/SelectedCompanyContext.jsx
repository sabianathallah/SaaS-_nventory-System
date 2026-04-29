import { createContext, useContext, useState, useEffect } from 'react'
import { setAxiosCompanyScope } from '../api/axios'

const SelectedCompanyContext = createContext(null)

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('selectedCompany')) ?? null }
  catch { return null }
}

export function SelectedCompanyProvider({ children }) {
  const [selectedCompany, setSelectedCompanyState] = useState(readSession)

  // Sync axios on mount (handles page refresh)
  useEffect(() => {
    setAxiosCompanyScope(selectedCompany?.id ?? null)
  }, []) // eslint-disable-line

  const setSelectedCompany = (company) => {
    setSelectedCompanyState(company)
    setAxiosCompanyScope(company?.id ?? null)
    if (company) sessionStorage.setItem('selectedCompany', JSON.stringify(company))
    else sessionStorage.removeItem('selectedCompany')
  }

  return (
    <SelectedCompanyContext.Provider value={{ selectedCompany, setSelectedCompany }}>
      {children}
    </SelectedCompanyContext.Provider>
  )
}

export const useSelectedCompany = () => useContext(SelectedCompanyContext)
