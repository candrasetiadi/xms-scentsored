'use client'

// Cetak label parfum — Brother PT-P900W (TZe 36mm black-on-white laminated)
// MVP: browser print via popup window (lebih reliable di Windows daripada window.print() langsung).
// TODO(production): jalur via P-touch Template + print agent lokal (TCP ke
//   Brother PT-P900W di LAN toko via Wi-Fi) — belum dikerjakan di MVP.

interface Props {
  perfumeName:  string
  perfumeSize:  string   // e.g. "50 ml"
  perfumeType:  string   // e.g. "EXTRAIT DE PARFUM"
  printQty:     number
  orderItemId:  string   // UUID order_item
  orderDate:    string   // ISO timestamp order dibuat
}

// Format batch code: YYMMDD-XXXXXXXX-001
function makeBatchCode(orderItemId: string, orderDate: string, seq: number): string {
  const d    = new Date(orderDate)
  const yy   = String(d.getFullYear()).slice(2)
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  const code = orderItemId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const s    = String(seq).padStart(3, '0')
  return `${yy}${mm}${dd}-${code}-${s}`
}

// CSS standalone untuk popup print — tidak bergantung pada halaman utama
const POPUP_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  @page { size: 36mm 40mm; margin: 0; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .label-print {
    width: 36mm; height: 40mm; overflow: hidden;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    padding: 2mm 2mm; page-break-inside: avoid; background: white;
  }
  .label-print:not(:last-child) { page-break-after: always; }
  .lp-logo { height: 11mm; width: auto; object-fit: contain; margin-top: 1.5mm; }
  .lp-name {
    font-family: Georgia, serif; font-size: 8pt; font-weight: 700;
    line-height: 1.2; text-align: center; color: #000;
    word-break: break-word; text-transform: uppercase;
    flex: 1; display: flex; align-items: center; justify-content: center;
  }
  .lp-bottom {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.5mm; margin-bottom: 1.5mm;
  }
  .lp-size  { font-size: 5.5pt; font-weight: 700; letter-spacing: .06em; text-align: center; color: #000; }
  .lp-type  { font-size: 4pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; text-align: center; color: #000; }
  .lp-batch { font-size: 3.5pt; font-weight: 700; letter-spacing: .04em; color: #000; margin-top: 0.5mm; font-family: 'Courier New', monospace; text-align: center; }
`

export function LabelPrintClient({ perfumeName, perfumeSize, perfumeType, printQty, orderItemId, orderDate }: Props) {
  const labels = Array.from({ length: printQty })

  async function handlePrint() {
    // Generate PDF dengan dimensi 36×40mm yang baked-in — reliable di semua OS/browser
    const { jsPDF } = await import('jspdf')

    const W = 36, H = 40          // mm
    const DPI = 300                // resolusi render canvas
    const PX_W = Math.ceil(W * DPI / 25.4)  // 425px
    const PX_H = Math.ceil(H * DPI / 25.4)  // 472px
    const PT = (mm: number) => mm * DPI / 25.4  // mm → px helper

    // Load logo SVG sebagai Image element
    const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = `${window.location.origin}/brand/logo-web-bold.svg`
    })

    const pdf = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait' })

    for (let i = 0; i < printQty; i++) {
      if (i > 0) pdf.addPage([W, H], 'portrait')

      const canvas = document.createElement('canvas')
      canvas.width  = PX_W
      canvas.height = PX_H
      const ctx = canvas.getContext('2d')!

      // Background putih
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, PX_W, PX_H)

      // Logo — tinggi 11mm, centered
      const logoH = PT(11)
      const logoW = logoImg.naturalWidth * (logoH / logoImg.naturalHeight)
      const logoX = (PX_W - logoW) / 2
      ctx.drawImage(logoImg, logoX, PT(2.5), logoW, logoH)

      // Nama parfum — bold, centered, uppercase
      const nameFontPx = PT(2.8)  // ≈ 8pt
      ctx.fillStyle = '#000000'
      ctx.font = `bold ${nameFontPx}px Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(perfumeName.toUpperCase(), PX_W / 2, PT(22))

      // Ukuran
      const sizeFontPx = PT(1.9)  // ≈ 5.5pt
      ctx.font = `bold ${sizeFontPx}px Arial, sans-serif`
      ctx.letterSpacing = '2px'
      ctx.fillText(perfumeSize, PX_W / 2, PT(30))

      // Konsentrasi
      const typeFontPx = PT(1.4)  // ≈ 4pt
      ctx.font = `600 ${typeFontPx}px Arial, sans-serif`
      ctx.fillText(perfumeType.toUpperCase(), PX_W / 2, PT(33.5))

      // Batch code
      const batchFontPx = PT(1.2)  // ≈ 3.5pt
      ctx.font = `bold ${batchFontPx}px 'Courier New', monospace`
      ctx.fillText(makeBatchCode(orderItemId, orderDate, i + 1), PX_W / 2, PT(36.5))

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, W, H)
    }

    // Buka PDF di tab baru — user print dari PDF viewer (size selalu exact)
    const blob = pdf.output('blob')
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  return (
    <>
      {/* ── Kontrol (layar saja) ── */}
      <div id="screen-controls">
        <div style={{ position:'fixed', top:0, left:0, right:0, background:'#fff', borderBottom:'1px solid #ddd', padding:'8px 16px', display:'flex', gap:8, alignItems:'center', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}>
          <button
            onClick={() => { handlePrint().catch(console.error) }}
            style={{ height:32, padding:'0 16px', borderRadius:6, background:'#064733', color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer' }}
          >
            Cetak Label (PDF)
          </button>
          <button
            onClick={() => window.close()}
            style={{ height:32, padding:'0 16px', borderRadius:6, background:'#fff', color:'#3d2e26', fontSize:13, fontWeight:500, border:'1px solid #ccc', cursor:'pointer' }}
          >
            Tutup
          </button>
          <span style={{ fontSize:12, color:'#6f6256', marginLeft:8 }}>
            {printQty} label · {perfumeName} · {perfumeSize}
          </span>
          <span style={{ fontSize:11, color:'#aaa', marginLeft:'auto' }}>
            Brother PT-P900W · TZe 36mm · 36×40mm
          </span>
          <span style={{ fontSize:11, color:'#b45309', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:4, padding:'2px 8px', marginLeft:8 }}>
            ⚠ PDF akan terbuka di tab baru → print dari sana · pastikan Scale = 100% · No margins
          </span>
        </div>

        {/* ── Preview layar: 3× scale ── */}
        <div style={{ background:'#f0ece8', minHeight:'100vh', display:'flex', flexWrap:'wrap', gap:24, padding:'72px 24px 32px', alignItems:'flex-start', justifyContent:'center' }}>
          {labels.map((_, i) => (
            <div key={i} className="label-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-web-bold.svg" alt="Scentsored" className="lp-logo" />
              <p className="lp-name">{perfumeName}</p>
              <div className="lp-bottom">
                <p className="lp-size">{perfumeSize}</p>
                <p className="lp-type">{perfumeType}</p>
                <p className="lp-batch">{makeBatchCode(orderItemId, orderDate, i + 1)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Print output (fallback jika popup diblokir) ── */}
      <div id="print-labels">
        {labels.map((_, i) => (
          <div key={i} className="label-print">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-web-bold.svg" alt="Scentsored" className="lp-logo" />
            <p className="lp-name">{perfumeName}</p>
            <div className="lp-bottom">
              <p className="lp-size">{perfumeSize}</p>
              <p className="lp-type">{perfumeType}</p>
              <p className="lp-batch">{makeBatchCode(orderItemId, orderDate, i + 1)}</p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        /* ── Shared text styles ── */
        .lp-name, .lp-size, .lp-type {
          margin: 0;
          text-align: center;
          color: #000;
          font-family: 'Inter Tight', system-ui, sans-serif;
        }

        /* ══ SCREEN PREVIEW (3× of print) ══ */
        #print-labels { display: none; }

        .label-preview {
          width: min(108mm, 90vw);
          height: min(120mm, calc(90vw * 40 / 36));
          background: #fff;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 6mm 4mm;
          border: 1px dashed #bbb;
        }

        .label-preview .lp-logo {
          height: 31mm;
          width: auto;
          object-fit: contain;
          margin-top: 6mm;
        }
        .label-preview .lp-name {
          font-family: 'Chatime', Georgia, serif;
          font-size: 24pt;
          font-weight: 700;
          line-height: 1.2;
          margin: 0;
          word-break: break-word;
          hyphens: auto;
          text-transform: uppercase;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .label-preview .lp-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5mm;
          margin-bottom: 6mm;
        }
        .label-preview .lp-size {
          font-size: 16.5pt;
          font-weight: 700;
          letter-spacing: .06em;
          margin: 0;
        }
        .label-preview .lp-type {
          font-size: 12pt;
          font-weight: 600;
          letter-spacing: .14em;
          text-transform: uppercase;
          margin: 0;
        }
        .label-preview .lp-batch {
          font-size: 8pt;
          font-weight: 700;
          letter-spacing: .05em;
          color: #333;
          margin: 0;
          margin-top: 1.5mm;
          font-family: 'Courier New', monospace;
        }

        /* ══ PRINT OUTPUT (fallback) ══ */
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #screen-controls { display: none !important; }
          #print-labels    { display: block !important; }

          @page {
            size: 36mm 40mm;
            margin: 0;
          }

          .label-print {
            width: 36mm;
            height: 40mm;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 2mm 2mm;
            page-break-inside: avoid;
            background: white;
          }
          .label-print:not(:last-child) {
            page-break-after: always;
          }

          .label-print .lp-logo {
            height: 11mm;
            width: auto;
            object-fit: contain;
            margin-top: 1.5mm;
          }
          .label-print .lp-name {
            font-family: 'Chatime', Georgia, serif;
            font-size: 8pt;
            font-weight: 700;
            line-height: 1.2;
            margin: 0;
            word-break: break-word;
            hyphens: auto;
            text-transform: uppercase;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-print .lp-bottom {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5mm;
            margin-bottom: 1.5mm;
          }
          .label-print .lp-size {
            font-size: 5.5pt;
            font-weight: 700;
            letter-spacing: .06em;
            margin: 0;
          }
          .label-print .lp-type {
            font-size: 4pt;
            font-weight: 600;
            letter-spacing: .12em;
            text-transform: uppercase;
            margin: 0;
          }
          .label-print .lp-batch {
            font-size: 3.5pt;
            font-weight: 700;
            letter-spacing: .04em;
            color: #000;
            margin: 0;
            margin-top: 0.5mm;
            font-family: 'Courier New', monospace;
          }
        }
      `}</style>
    </>
  )
}
