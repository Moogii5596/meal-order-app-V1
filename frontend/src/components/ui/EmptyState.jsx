import React from 'react';
import './ui.css';

function EmptyState({
  message = 'Мэдээлэл алга'
}) {

  return (
    <div className="ui-empty">
      {message}
    </div>
  );
}
export default EmptyState;