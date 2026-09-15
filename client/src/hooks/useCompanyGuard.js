import { useAuth } from '../context/AuthContext'
import { useSelectedCompany } from '../context/SelectedCompanyContext'

/**
 * Returns needsCompany=true when the current user is SUPER_ADMIN
 * but hasn't selected a specific company yet.
 * Used to block write operations that would save data without a companyId.
 */
export function useCompanyGuard() {
  const { isSuperAdmin } = useAuth()
  const { selectedCompany } = useSelectedCompany()
  return { needsCompany: isSuperAdmin && !selectedCompany }
}
