import { QRCode } from 'react-qr-code'

export default function QRLabel({ product, size = 96 }) {
  return (
    <div className="qr-label-item">
      <QRCode value={product.sku} size={size} bgColor="#ffffff" fgColor="#000000" level="M" />
      <p className="qr-label-name">{product.name}</p>
      <p className="qr-label-sku">{product.sku}</p>
    </div>
  )
}
