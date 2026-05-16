import React from 'react';
import './ui.css';
function PageLoader({
  message = 'Ачаалж байна...'
}) {

  return (
    <div className="ui-loader">
      {message}
    </div>
  );
}
export default PageLoader;