import { COLORS } from "./constants";

/**
 * Parse inline bold text (**text**) in a string and convert to React elements
 * @param {string} text - Text with possible **bold** markers
 * @returns {Array} Array of text and <strong> elements
 */
function parseInlineBold(text) {
  const parts = [];
  let currentIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    // Add bold text
    parts.push(<strong key={match.index} style={{ fontWeight: 600 }}>{match[1]}</strong>);
    currentIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Parse hyperlinks in text and convert to <a> tags
 * Supports: https://example.com or (https://example.com)
 * @param {string|Array} content - Text or array with possible URLs
 * @returns {Array} Array of text and <a> elements
 */
function parseHyperlinks(content) {
  // If content is already an array (from parseInlineBold), process each part
  const textContent = Array.isArray(content) 
    ? content.map(part => typeof part === 'string' ? part : part.props.children).join('**BOLD**')
    : content;
  
  const parts = [];
  let currentIndex = 0;
  
  // Regex for URLs: (https://...) or https://...
  const urlRegex = /(\()?https?:\/\/[^\s)]+(\))?/g;
  let match;

  while ((match = urlRegex.exec(textContent)) !== null) {
    const url = match[0].replace(/[()]/g, ''); // Remove parentheses
    const displayText = url.length > 50 ? url.substring(0, 47) + '...' : url;
    
    // Add text before the match
    if (match.index > currentIndex) {
      const beforeText = textContent.substring(currentIndex, match.index);
      parts.push(...parseInlineBold(beforeText));
    }
    
    // Add hyperlink
    parts.push(
      <a 
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: COLORS.primary,
          fontWeight: 500,
          textDecoration: "none",
          borderBottom: `1px solid ${COLORS.primary}`,
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => e.target.style.opacity = "0.7"}
        onMouseLeave={(e) => e.target.style.opacity = "1"}
      >
        {displayText}
      </a>
    );
    
    currentIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (currentIndex < textContent.length) {
    const remainingText = textContent.substring(currentIndex);
    parts.push(...parseInlineBold(remainingText));
  }

  return parts.length > 0 ? parts : parseInlineBold(textContent);
}

/**
 * Render markdown-style content to React elements with proper spacing
 * @param {string} text - Markdown-formatted text
 * @returns {Array} Array of React elements
 */
export function renderContent(text) {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];
  let listType = null; // 'bullet' or 'numbered'
  let tableRows = [];
  let isInTable = false;

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType === 'numbered' ? 'ol' : 'ul';
      elements.push(
        <ListTag 
          key={`list-${elements.length}`} 
          style={{
            marginLeft: "20px",
            marginTop: "12px",
            marginBottom: "12px",
            paddingLeft: "8px",
          }}
        >
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(2); // Skip header and separator line

      elements.push(
        <table 
          key={`table-${elements.length}`}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "16px",
            marginBottom: "16px",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: COLORS.primaryLight }}>
              {headers.split('|').filter(h => h.trim()).map((header, idx) => (
                <th 
                  key={idx}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: COLORS.primary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: `2px solid ${COLORS.primary}`,
                  }}
                >
                  {parseInlineBold(header.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                style={{
                  borderBottom: `1px solid ${COLORS.borderLight}`,
                  background: rowIdx % 2 === 0 ? COLORS.bgPrimary : COLORS.bgSecondary,
                }}
              >
                {row.split('|').filter(c => c.trim()).map((cell, cellIdx) => (
                  <td 
                    key={cellIdx}
                    style={{
                      padding: "12px 16px",
                      fontSize: "13px",
                      color: COLORS.textSecondary,
                      lineHeight: 1.6,
                    }}
                  >
                    {parseInlineBold(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      tableRows = [];
      isInTable = false;
    }
  };

  lines.forEach((line, i) => {
    // Detect image syntax ![alt](src)
    if (line.trim().startsWith("![") && line.includes("](")) {
      flushList();
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
      const match = line.match(imageRegex);
      
      if (match) {
        const [, altText, imageSrc] = match;
        elements.push(
          <div
            key={`image-${i}`}
            style={{
              marginTop: "16px",
              marginBottom: "16px",
              textAlign: "center",
            }}
          >
            <img
              src={imageSrc}
              alt={altText}
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              }}
            />
          </div>
        );
      }
      return;
    }

    // Detect table start (line with |)
    if (line.includes('|') && !isInTable) {
      flushList();
      isInTable = true;
      tableRows.push(line);
      return;
    }

    // Continue collecting table rows
    if (isInTable && line.includes('|')) {
      tableRows.push(line);
      return;
    }

    // End of table
    if (isInTable && !line.includes('|')) {
      flushTable();
    }

    // Bold headers (e.g., **Header** atau **Header** dengan spasi)
    if (line.trim().startsWith("**") && line.trim().endsWith("**")) {
      flushList();
      elements.push(
        <p
          key={`header-${i}`}
          style={{
            fontWeight: 700,
            color: COLORS.textPrimary,
            marginTop: "20px",
            marginBottom: "10px",
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {line.trim().replace(/\*\*/g, "")}
        </p>
      );
      return;
    }

    // Bullet points (e.g., - Item)
    if (line.startsWith("- ")) {
      if (listType !== 'bullet') {
        flushList();
        listType = 'bullet';
      }
      const content = line.slice(2);
      listItems.push(
        <li
          key={`bullet-${i}`}
          style={{
            color: COLORS.textSecondary,
            fontSize: "14px",
            marginBottom: "6px",
            lineHeight: 1.7,
            paddingLeft: "4px",
          }}
        >
          {parseHyperlinks(content)}
        </li>
      );
      return;
    }

    // Numbered list (e.g., 1. Item)
    if (/^\d+\./.test(line)) {
      if (listType !== 'numbered') {
        flushList();
        listType = 'numbered';
      }
      const content = line.replace(/^\d+\.\s/, "");
      listItems.push(
        <li
          key={`numbered-${i}`}
          style={{
            color: COLORS.textSecondary,
            fontSize: "14px",
            marginBottom: "6px",
            lineHeight: 1.7,
            paddingLeft: "4px",
          }}
        >
          {parseHyperlinks(content)}
        </li>
      );
      return;
    }

    // Italic text (e.g., *italic*)
    if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      flushList();
      elements.push(
        <p
          key={`italic-${i}`}
          style={{
            color: COLORS.textMuted,
            fontSize: "12px",
            fontStyle: "italic",
            marginTop: "12px",
            marginBottom: "8px",
          }}
        >
          {line.replace(/\*/g, "")}
        </p>
      );
      return;
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      elements.push(<div key={`spacer-${i}`} style={{ height: "8px" }} />);
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={`p-${i}`}
        style={{
          color: COLORS.textSecondary,
          fontSize: "14px",
          lineHeight: 1.8,
          marginBottom: "8px",
        }}
      >
        {parseHyperlinks(line)}
      </p>
    );
  });

  // Flush any remaining list items or table
  flushList();
  flushTable();

  return elements;
}
