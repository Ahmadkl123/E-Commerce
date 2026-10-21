export default function QuantityStepper({ value, min = 1, max, onChange, disabled }) {
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
      >
        −
      </button>
      <span data-testid="quantity">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        disabled={disabled || (max !== undefined && value >= max)}
      >
        +
      </button>
    </div>
  );
}
