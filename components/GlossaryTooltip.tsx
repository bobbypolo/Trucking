import React, { useState } from "react";
import { glossary } from "../data/truckingGlossary";

interface GlossaryTooltipProps {
  /** The glossary key to look up (e.g. "BOL", "IFTA"). Case-insensitive. */
  term: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * GlossaryTooltip — wraps any inline element and shows a plain-English
 * definition on hover when the term exists in the trucking glossary.
 * When the term is unknown the children render without any wrapper overhead.
 */
export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({
  term,
  children,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const definition = glossary[term.toUpperCase()];

  if (!definition) {
    return <>{children}</>;
  }

  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", cursor: "help" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      data-testid="glossary-tooltip-trigger"
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          data-testid="glossary-tooltip-content"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1e293b",
            color: "#f8fafc",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "0.8rem",
            lineHeight: "1.4",
            whiteSpace: "normal",
            width: "260px",
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          <strong>{term.toUpperCase()}: </strong>
          {definition}
        </span>
      )}
    </span>
  );
};

export default GlossaryTooltip;
