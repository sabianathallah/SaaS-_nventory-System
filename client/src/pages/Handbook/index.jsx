import { Routes, Route } from 'react-router-dom'
import HandbookHome from './HandbookHome'
import HandbookPolicies from './HandbookPolicies'
import HandbookOrgChart from './HandbookOrgChart'

export default function Handbook() {
  return (
    <Routes>
      <Route index element={<HandbookHome />} />
      <Route path="kebijakan" element={<HandbookPolicies />} />
      <Route path="struktur" element={<HandbookOrgChart />} />
    </Routes>
  )
}
