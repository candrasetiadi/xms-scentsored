// Layout minimal untuk halaman cetak — tanpa AppNav, tanpa sidebar.
// Middleware tetap menjaga auth.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white min-h-screen">
      {children}
    </div>
  )
}
