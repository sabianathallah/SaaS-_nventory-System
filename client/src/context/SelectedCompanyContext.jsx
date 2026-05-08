import { createContext, useContext, useState, useEffect } from 'react'
import { setAxiosCompanyScope } from '../api/axios'

const SelectedCompanyContext = createContext(null)

function readSession() {
  try { return JSON.parse(sessionStorage.getItem('selectedCompany')) ?? null }
  catch { return null }
}

export function SelectedCompanyProvider({ children }) {
  const [selectedCompany, setSelectedCompanyState] = useState(() => {
    const company = readSession()
    setAxiosCompanyScope(company?.id ?? null) // set synchronously before first render
    return company
  })

  // Keep in sync if sessionStorage changes externally (e.g. other tabs)
  useEffect(() => {
    setAxiosCompanyScope(selectedCompany?.id ?? null)
  }, [selectedCompany])

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
