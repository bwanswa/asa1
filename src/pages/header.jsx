import React from "react";
import "./Header.css"; // make sure this file is beside Header.jsx

const Header = () => {
  return (
    <header className="asa-header">
      <div className="asa-logo">
        <img src="/asa-logo.png" alt="ASA Logo" />
      </div>
      <div className="asa-header-right">
        <div className="asa-header-text" id="headerText">
          Free Ourselves from Mental Slavery
        </div>
        <select
          className="asa-language-select"
          onChange={(e) => translatePage(e.target.value)}
        >
          <option value="en">English</option>
          <option value="sw">Swahili</option>
          <option value="fr">French</option>
        </select>
      </div>
    </header>
  );
};

function translatePage(lang) {
  const translations = {
    en: { header: "Free Ourselves from Mental Slavery" },
    sw: { header: "Tujikomboe kutoka kwa utumwa wa kiakili" },
    fr: { header: "Libérons-nous de l'esclavage mental" },
  };
  document.getElementById("headerText").textContent =
    translations[lang]?.header || translations.en.header;
}

export default Header;
