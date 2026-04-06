import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './Iso25010Matrix.css';

// ISO/IEC 25010 Quality Model - Software Quality Characteristics
const ISO_25010 = {
  "Functional Suitability": ["Functional Completeness", "Functional Correctness", "Functional Appropriateness"],
  "Performance Efficiency": ["Time Behaviour", "Resource Utilization", "Capacity"],
  "Compatibility": ["Co-existence", "Interoperability"],
  "Usability": ["Appropriateness Recognizability", "Learnability", "Operability", "User Error Protection", "User Interface Aesthetics", "Accessibility"],
  "Reliability": ["Maturity", "Availability", "Fault Tolerance", "Recoverability"],
  "Security": ["Confidentiality", "Integrity", "Non-repudiation", "Accountability", "Authenticity"],
  "Maintainability": ["Modularity", "Reusability", "Analysability", "Modifiability", "Testability"],
  "Portability": ["Adaptability", "Installability", "Replaceability"]
};

export default function Iso25010Matrix({ projectId }) {
  const [nfrs, setNfrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [coverage, setCoverage] = useState({ covered: 0, total: 0, percentage: 0 });
  const [gaps, setGaps] = useState([]);

  useEffect(() => {
    if (!projectId) return;
    
    async function fetchNfrs() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("project_nfrs")
          .select("category, status")
          .eq("project_id", projectId);

        if (error) {
          console.error("Error fetching NFRs:", error);
        } else {
          setNfrs(data || []);
          calculateCoverage(data || []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchNfrs();
  }, [projectId]);

  const calculateCoverage = (nfrsData) => {
    const categoryMap = new Map();
    
    // Group NFRs by category and status
    nfrsData.forEach(nfr => {
      if (!categoryMap.has(nfr.category)) {
        categoryMap.set(nfr.category, { approved: 0, pending: 0 });
      }
      const counts = categoryMap.get(nfr.category);
      if (nfr.status === 'approved') {
        counts.approved++;
      } else if (nfr.status === 'pending') {
        counts.pending++;
      }
    });

    // Calculate coverage for each sub-characteristic
    const allSubCharacteristics = Object.values(ISO_25010).flat();
    const totalSubCharacteristics = allSubCharacteristics.length;
    let coveredCount = 0;
    const foundGaps = [];

    Object.entries(ISO_25010).forEach(([characteristic, subCharacteristics]) => {
      subCharacteristics.forEach(subChar => {
        const isCharCovered = isSubCharacteristicCovered(characteristic, subChar, categoryMap);
        if (isCharCovered) {
          coveredCount++;
        } else {
          foundGaps.push(`${characteristic} > ${subChar}`);
        }
      });
    });

    const percentage = Math.round((coveredCount / totalSubCharacteristics) * 100);
    setCoverage({ covered: coveredCount, total: totalSubCharacteristics, percentage });
    setGaps(foundGaps);
  };

  // Fuzzy matching function to match NFR categories to ISO taxonomy
  const isSubCharacteristicCovered = (characteristic, subCharacteristic, categoryMap) => {
    // Check exact matches first
    if (categoryMap.has(characteristic) || categoryMap.has(subCharacteristic)) {
      return true;
    }

    // Check for fuzzy matches
    for (const [category] of categoryMap) {
      const categoryLower = category.toLowerCase();
      const charLower = characteristic.toLowerCase();
      const subCharLower = subCharacteristic.toLowerCase();

      // Check if category contains the characteristic or sub-characteristic
      if (categoryLower.includes(charLower) || 
          categoryLower.includes(subCharLower) ||
          charLower.includes(categoryLower) ||
          subCharLower.includes(categoryLower)) {
        return true;
      }

      // Check for compound categories like "Security - Confidentiality"
      if (categoryLower.includes('-') || categoryLower.includes('_')) {
        const parts = categoryLower.split(/[-_\s]+/);
        if (parts.some(part => 
          part.includes(charLower) || 
          part.includes(subCharLower) ||
          charLower.includes(part) ||
          subCharLower.includes(part)
        )) {
          return true;
        }
      }
    }

    return false;
  };

  const getSubCharacteristicStatus = (characteristic, subCharacteristic) => {
    const categoryMap = new Map();
    
    nfrs.forEach(nfr => {
      if (!categoryMap.has(nfr.category)) {
        categoryMap.set(nfr.category, { approved: 0, pending: 0 });
      }
      const counts = categoryMap.get(nfr.category);
      if (nfr.status === 'approved') {
        counts.approved++;
      } else if (nfr.status === 'pending') {
        counts.pending++;
      }
    });

    // Find matching categories
    const matchingCategories = [];
    for (const [category, counts] of categoryMap) {
      const categoryLower = category.toLowerCase();
      const charLower = characteristic.toLowerCase();
      const subCharLower = subCharacteristic.toLowerCase();

      if (category === characteristic || category === subCharacteristic ||
          categoryLower.includes(charLower) || categoryLower.includes(subCharLower) ||
          charLower.includes(categoryLower) || subCharLower.includes(categoryLower)) {
        matchingCategories.push(counts);
      }

      if (categoryLower.includes('-') || categoryLower.includes('_')) {
        const parts = categoryLower.split(/[-_\s]+/);
        if (parts.some(part => 
          part.includes(charLower) || part.includes(subCharLower) ||
          charLower.includes(part) || subCharLower.includes(part)
        )) {
          matchingCategories.push(counts);
        }
      }
    }

    if (matchingCategories.length === 0) {
      return { status: 'none', count: 0 };
    }

    const totalApproved = matchingCategories.reduce((sum, cat) => sum + cat.approved, 0);
    const totalPending = matchingCategories.reduce((sum, cat) => sum + cat.pending, 0);

    if (totalApproved > 0) {
      return { status: 'approved', count: totalApproved };
    } else if (totalPending > 0) {
      return { status: 'pending', count: totalPending };
    }

    return { status: 'none', count: 0 };
  };

  const toggleRowExpansion = (characteristic) => {
    setExpandedRows(prev => ({
      ...prev,
      [characteristic]: !prev[characteristic]
    }));
  };

  const handleGenerateMissingNfrs = () => {
    // This could be implemented to trigger NFR generation
    // For now, just show what gaps exist
    alert(`Found ${gaps.length} coverage gaps:\n\n${gaps.slice(0, 10).join('\n')}${gaps.length > 10 ? '\n...' : ''}`);
  };

  if (loading) {
    return (
      <div className="iso-matrix-loading">
        <div className="loading-spinner"></div>
        <p>Loading ISO/IEC 25010 coverage...</p>
      </div>
    );
  }

  return (
    <div className="iso-matrix">
      {/* Header with Coverage Summary */}
      <div className="iso-matrix-header">
        <h2>ISO/IEC 25010 Coverage Matrix</h2>
        <div className="coverage-summary">
          <div className="coverage-text">
            Coverage: {coverage.covered}/{coverage.total} sub-characteristics ({coverage.percentage}%)
          </div>
          <div className="coverage-bar">
            <div 
              className="coverage-progress" 
              style={{ width: `${coverage.percentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="iso-matrix-grid">
        {Object.entries(ISO_25010).map(([characteristic, subCharacteristics]) => {
          const isExpanded = expandedRows[characteristic];
          const characteristicCounts = subCharacteristics.reduce((acc, subChar) => {
            const status = getSubCharacteristicStatus(characteristic, subChar);
            if (status.status === 'approved') acc.approved += status.count;
            if (status.status === 'pending') acc.pending += status.count;
            return acc;
          }, { approved: 0, pending: 0 });

          return (
            <div key={characteristic} className="matrix-row">
              {/* Main Characteristic Row */}
              <div 
                className="characteristic-row" 
                onClick={() => toggleRowExpansion(characteristic)}
              >
                <div className="characteristic-name">
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                  {characteristic}
                  <span className="nfr-count">
                    ({characteristicCounts.approved + characteristicCounts.pending} NFRs)
                  </span>
                </div>
                <div className="characteristic-status">
                  <div className={`status-indicator ${characteristicCounts.approved > 0 ? 'approved' : characteristicCounts.pending > 0 ? 'pending' : 'none'}`}>
                    {characteristicCounts.approved > 0 ? `${characteristicCounts.approved} Approved` : 
                     characteristicCounts.pending > 0 ? `${characteristicCounts.pending} Pending` : 'No Coverage'}
                  </div>
                </div>
              </div>

              {/* Sub-characteristics (expandable) */}
              {isExpanded && (
                <div className="sub-characteristics">
                  {subCharacteristics.map(subChar => {
                    const subStatus = getSubCharacteristicStatus(characteristic, subChar);
                    return (
                      <div key={subChar} className="sub-characteristic-row">
                        <div className="sub-characteristic-name">
                          {subChar}
                        </div>
                        <div className="sub-characteristic-status">
                          <div className={`status-cell ${subStatus.status}`}>
                            {subStatus.status === 'approved' ? `${subStatus.count} ✓` :
                             subStatus.status === 'pending' ? `${subStatus.count} ⏳` : '—'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gaps Section */}
      {gaps.length > 0 && (
        <div className="gaps-section">
          <h3>Coverage Gaps ({gaps.length})</h3>
          <div className="gaps-list">
            {gaps.slice(0, 10).map((gap, index) => (
              <div key={index} className="gap-item">
                ❌ {gap}
              </div>
            ))}
            {gaps.length > 10 && (
              <div className="gap-item more">
                ... and {gaps.length - 10} more
              </div>
            )}
          </div>
          <button 
            className="generate-btn" 
            onClick={handleGenerateMissingNfrs}
          >
            Generate Missing NFRs
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="matrix-legend">
        <div className="legend-item">
          <div className="legend-color approved"></div>
          <span>Approved NFRs</span>
        </div>
        <div className="legend-item">
          <div className="legend-color pending"></div>
          <span>Pending NFRs</span>
        </div>
        <div className="legend-item">
          <div className="legend-color none"></div>
          <span>No Coverage</span>
        </div>
      </div>
    </div>
  );
}