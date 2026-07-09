'use client'

// Cetak label parfum — Brother PT-P900W (TZe 36mm black-on-white laminated)
// MVP: browser print dialog dengan @page 36×40mm.
// TODO(production): jalur via P-touch Template + print agent lokal (TCP ke
//   Brother PT-P900W di LAN toko via Wi-Fi) — belum dikerjakan di MVP.

import { useEffect } from 'react'

interface Props {
  perfumeName: string
  perfumeSize: string  // e.g. "50 mL"
  perfumeType: string  // e.g. "EXTRAIT DE PARFUM"
  printQty:    number
}

// Monogram wax-seal — SVG lingkaran statis, monokrom
function WaxSeal({ size }: { size: number }) {
  const r1 = size * 0.464   // outer ring radius
  const r2 = size * 0.357   // inner ring radius
  const cx = size / 2
  const fs = size * 0.357   // font-size for "S"
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={cx} cy={cx} r={r1} stroke="#000" strokeWidth={size * 0.043} />
      <circle cx={cx} cy={cx} r={r2} stroke="#000" strokeWidth={size * 0.021} />
      <text
        x={cx} y={cx + fs * 0.36}
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize={fs}
        fontWeight="bold"
        fill="#000"
        letterSpacing="0.05em"
      >S</text>
    </svg>
  )
}

export function LabelPrintClient({ perfumeName, perfumeSize, perfumeType, printQty }: Props) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [])

  const labels = Array.from({ length: printQty })

  return (
    <>
      {/* ── Kontrol (layar saja) ── */}
      <div id="screen-controls">
        <div style={{ position:'fixed', top:0, left:0, right:0, background:'#fff', borderBottom:'1px solid #ddd', padding:'8px 16px', display:'flex', gap:8, alignItems:'center', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}>
          <button
            onClick={() => window.print()}
            style={{ height:32, padding:'0 16px', borderRadius:6, background:'#064733', color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer' }}
          >
            Cetak Label
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
        </div>

        {/* ── Preview layar: 3× scale ── */}
        <div style={{ paddingTop:56, background:'#f0ece8', minHeight:'100vh', display:'flex', flexWrap:'wrap', gap:24, padding:'72px 24px 32px', alignItems:'flex-start' }}>
          {labels.map((_, i) => (
            <div key={i} className="label-preview">
              {/* Wax seal — 30mm rendered at ~113px (3× of 10mm) */}
              <WaxSeal size={113} />
              <p className="lp-brand">SCENTSORED PERFUMERY</p>
              <p className="lp-name">{perfumeName}</p>
              <p className="lp-size">{perfumeSize}</p>
              <p className="lp-type">{perfumeType}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Print output: actual 32×40mm ── */}
      <div id="print-labels">
        {labels.map((_, i) => (
          <div key={i} className="label-print">
            <WaxSeal size={38} />  {/* ~10mm at 96dpi */}
            <p className="lp-brand">SCENTSORED PERFUMERY</p>
            <p className="lp-name">{perfumeName}</p>
            <p className="lp-size">{perfumeSize}</p>
            <p className="lp-type">{perfumeType}</p>
          </div>
        ))}
      </div>

      <style>{`
        /* ── Shared text styles ── */
        .lp-brand, .lp-name, .lp-size, .lp-type {
          margin: 0;
          text-align: center;
          color: #000;
          font-family: 'Inter Tight', system-ui, sans-serif;
        }

        /* ══ SCREEN PREVIEW (3× of print) ══ */
        #print-labels { display: none; }

        .label-preview {
          width: 108mm;          /* 36mm × 3 */
          height: 120mm;         /* 40mm × 3 */
          background: #fff;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 6mm 4mm;
          border: 1px dashed #bbb;
        }

        .label-preview .lp-brand {
          font-size: 12pt;       /* 4pt × 3 */
          letter-spacing: .16em;
          text-transform: uppercase;
          margin: 4.5mm 0 9mm;
        }
        .label-preview .lp-name {
          font-family: 'Chatime', Georgia, serif;
          font-size: 24pt;       /* 8pt × 3 */
          line-height: 1.2;
          margin: 0 0 3mm;
          word-break: break-word;
          hyphens: auto;
          text-transform: uppercase;
        }
        .label-preview .lp-size {
          font-size: 16.5pt;     /* 5.5pt × 3 */
          letter-spacing: .06em;
          margin: 0 0 9mm;
        }
        .label-preview .lp-type {
          font-size: 12pt;       /* 4pt × 3 */
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        /* ══ PRINT OUTPUT ══ */
        @media print {
          html, body { margin: 0; padding: 0; background: white !important; }

          #screen-controls { display: none !important; }
          #print-labels    { display: block !important; }

          @page {
            size: 36mm 40mm;
            margin: 0 2mm;        /* content area 32mm × 40mm */
          }

          .label-print {
            width: 32mm;
            height: 40mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2mm 1mm;
            page-break-after: always;
            page-break-inside: avoid;
            background: white;
          }

          .label-print .lp-brand {
            font-size: 4pt;
            letter-spacing: .14em;
            text-transform: uppercase;
            margin: 1.5mm 0 3mm;
          }
          .label-print .lp-name {
            font-family: 'Chatime', Georgia, serif;
            font-size: 8pt;
            line-height: 1.2;
            margin: 0 0 1mm;
            word-break: break-word;
            hyphens: auto;
            text-transform: uppercase;
          }
          .label-print .lp-size {
            font-size: 5.5pt;
            letter-spacing: .06em;
            margin: 0 0 3mm;
          }
          .label-print .lp-type {
            font-size: 4pt;
            letter-spacing: .12em;
            text-transform: uppercase;
          }
        }
      `}</style>
    </>
  )
}
