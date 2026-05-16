import React from 'react';
import './ui.css';

function Card({ children }) {

  return (
    <div className="ui-card">
      {children}
    </div>
  );

}
export default Card;
