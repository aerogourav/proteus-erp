export function TechnicalIllustration({ number, revision, name }: { number: string; revision: string; name: string }) {
  const titleId = `illustration-${number.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <figure style={{ margin: 0, padding: 15, background: "#f8fafc", border: "1px solid #e2e8ef", borderRadius: 6 }}>
    <svg viewBox="0 0 560 250" role="img" aria-labelledby={titleId} style={{ display: "block", width: "100%", height: "auto", color: "#527aa9" }}>
      <desc id={titleId}>Illustrative drawing for {number}, revision {revision}; not to scale or for manufacture</desc>
      <defs><pattern id={`${titleId}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e7edf3" strokeWidth=".7" /></pattern></defs>
      <rect width="560" height="250" fill={`url(#${titleId}-grid)`} />
      <g fill="none" stroke="currentColor" strokeWidth="2"><path d="M105 70h105l19 18v68l-19 18H105l-19-18V88z"/><circle cx="105" cy="105" r="13"/><circle cx="210" cy="105" r="13"/><circle cx="105" cy="141" r="7"/><circle cx="210" cy="141" r="7"/><path d="M86 55h143M86 48v14m143-14v14M75 70v104m-7-104h14m-14 104h14" strokeDasharray="4 4"/><path d="M330 92h118v54H330zM344 92v54m89-54v54M307 119h23m118 0h23"/><circle cx="389" cy="119" r="18"/><path d="M389 90v58m-29-29h58" strokeDasharray="4 4"/></g>
      <g fill="#8294a8" fontFamily="monospace" fontSize="9"><text x="88" y="39">ILLUSTRATIVE TOP VIEW</text><text x="330" y="75">SCHEMATIC SECTION</text><text x="88" y="199">{number} / REV {revision}</text><text x="88" y="215">{name}</text><text x="370" y="220">SYNTHETIC · NOT TO SCALE</text></g>
    </svg><figcaption style={{ marginTop: 8, color: "#78889a", fontSize: 9 }}>Illustrative drawing — synthetic demo data. Not to scale or for manufacture.</figcaption>
  </figure>;
}
