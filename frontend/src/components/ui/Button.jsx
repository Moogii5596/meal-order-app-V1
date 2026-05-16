import React from 'react';
import './ui.css';

function Button({
  children,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false
}) {

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`
        ui-btn
        ui-btn-${variant}
      `}
    >
      {children}
    </button>
  );

}

export default Button;
