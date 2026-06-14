export default function Toggle({ on, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`toggle-track ${on ? 'on' : 'off'}`}
      style={{ opacity: disabled ? 0.5 : 1 }}
      aria-pressed={on}
    >
      <span className="toggle-thumb" />
    </button>
  )
}
