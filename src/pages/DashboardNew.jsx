import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './DashboardNew.css';

// Custom hook for count-up animation
const useCountUp = (target, duration) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const startValue = 0;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * (target - startValue) + startValue);
      
      setCount(currentCount);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
};

// Helper functions for time formatting
const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInMinutes = Math.floor((now - time) / 60000);
  
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

const StatCard = ({ title, value, icon, delay, showPulse = false }) => {
  const animatedValue = useCountUp(value, 1500);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    
    setMousePosition({ x: rotateY, y: rotateX });
  }, []);

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div 
      className={`stat-card ${isHovered ? 'hovered' : ''}`}
      style={{ 
        '--delay': `${delay}ms`,
        '--rotate-x': `${mousePosition.y}deg`,
        '--rotate-y': `${mousePosition.x}deg`
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="stat-card-inner">
        <div className="stat-icon">{icon}</div>
        <div className="stat-content">
          <div className="stat-value">
            {animatedValue}
            {showPulse && <div className="pulse-indicator"></div>}
          </div>
          <div className="stat-title">{title}</div>
        </div>
      </div>
    </div>
  );
};

const PipelineStage = ({ stage, index, isHighlighted, onClick }) => {
  return (
    <div 
      className={`pipeline-stage ${stage.status} ${isHighlighted ? 'highlighted' : ''}`}
      style={{ '--delay': `${index * 200}ms` }}
      onClick={onClick}
    >
      <div className="stage-icon">{stage.icon}</div>
      <div className="stage-name">{stage.name}</div>
      <div className="stage-count">{stage.count}</div>
      <div className="stage-indicator"></div>
    </div>
  );
};

const ClusterCell = ({ cluster, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getColor = (divergence) => {
    if (divergence < 0.3) return '#10b981'; // green
    if (divergence < 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const truncatedName = cluster.name.length > 20 ? cluster.name.substring(0, 17) + '...' : cluster.name;

  return (
    <div 
      className="cluster-cell"
      style={{ 
        '--bg-color': getColor(cluster.divergence),
        '--delay': `${index * 50}ms`
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="cluster-name">{truncatedName}</div>
      <div className="cluster-score">{(cluster.divergence * 100).toFixed(0)}%</div>
      
      {isHovered && (
        <div className="cluster-tooltip">
          <div className="tooltip-title">{cluster.name}</div>
          <div className="tooltip-details">
            <div>Divergence: {(cluster.divergence * 100).toFixed(1)}%</div>
            <div>Submissions: {cluster.submissions}</div>
            <div>Priority: {cluster.priority.toFixed(1)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const PriorityBar = ({ cluster, index, maxPriority }) => {
  const percentage = (cluster.priority / maxPriority) * 100;
  const getRankColor = (rank) => {
    if (rank === 1) return 'linear-gradient(90deg, #ffd700, #ffed4a)'; // gold
    if (rank === 2) return 'linear-gradient(90deg, #c0c0c0, #e5e7eb)'; // silver
    if (rank === 3) return 'linear-gradient(90deg, #cd7f32, #d97706)'; // bronze
    return 'linear-gradient(90deg, #646cff, #8b5cf6)'; // blue
  };

  return (
    <div 
      className={`priority-bar ${index === 0 ? 'top-rank' : ''}`}
      style={{ '--delay': `${index * 100}ms` }}
    >
      <div className="rank-number">#{index + 1}</div>
      <div className="bar-content">
        <div className="cluster-name">{cluster.name}</div>
        <div className="bar-container">
          <div 
            className="bar-fill"
            style={{ 
              '--width': `${percentage}%`,
              '--bg': getRankColor(index + 1)
            }}
          ></div>
        </div>
        <div className="priority-score">{cluster.priority.toFixed(1)}</div>
      </div>
    </div>
  );
};

const ActivityItem = ({ activity, index }) => {
  return (
    <div 
      className="activity-item"
      style={{ '--delay': `${index * 100}ms` }}
    >
      <div 
        className="activity-dot"
        style={{ '--color': activity.color }}
      ></div>
      <div className="activity-content">
        <div className="activity-text">{activity.text}</div>
        <div className="activity-time">{activity.time}</div>
      </div>
    </div>
  );
};

const QuickAction = ({ title, icon, onClick, index }) => {
  return (
    <button 
      className="quick-action"
      style={{ '--delay': `${index * 50}ms` }}
      onClick={onClick}
    >
      <span className="action-icon">{icon}</span>
      <span className="action-title">{title}</span>
    </button>
  );
};

const DashboardNew = () => {
  const { id: projectId } = useParams();
  const [highlightedStage, setHighlightedStage] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    clusters: [],
    totalSubmissions: 0,
    activeConflicts: 0,
    totalNfrs: 0,
    activityFeed: [],
    pipelineStages: []
  });

  useEffect(() => {
    setMounted(true);
    if (projectId) {
      fetchDashboardData();
    }
  }, [projectId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all dashboard data in parallel
      const [
        { data: clusters, error: clustersError },
        { data: submissions, error: submissionsError },
        { data: conflicts, error: conflictsError },
        { data: nfrs, error: nfrsError },
        { data: divergenceScores, error: divergenceError },
        { data: prioritizationResults, error: prioritizationError }
      ] = await Promise.all([
        supabase.from('requirement_clusters').select('*').eq('project_id', projectId),
        supabase.from('stakeholder_submissions').select('*').eq('project_id', projectId),
        supabase.from('cluster_conflicts').select('*').eq('project_id', projectId),
        supabase.from('project_nfrs').select('*').eq('project_id', projectId),
        supabase.from('cluster_divergence_scores').select('*').eq('project_id', projectId),
        // NOTE: prioritization_results table (renamed from ahp_results via migration 005)
        // Now it stores smart prioritization results, but we keep the table name to avoid migrations
        supabase.from('prioritization_results').select('*').eq('project_id', projectId).order('rank', { ascending: true })
      ]);

      if (clustersError) throw clustersError;
      if (submissionsError) throw submissionsError;
      if (conflictsError) throw conflictsError;
      if (nfrsError) throw nfrsError;
      if (divergenceError) throw divergenceError;
      if (prioritizationError) throw prioritizationError;

      // Process clusters with divergence data and priority
      const clusterMap = {};
      (clusters || []).forEach(cluster => {
        clusterMap[cluster.id] = {
          ...cluster,
          name: cluster.label || `Cluster ${cluster.id?.slice(0, 6)}`,
          divergence: 0,
          priority: 0,
          submissions: cluster.submission_count || 0
        };
      });

      // Add divergence scores
      (divergenceScores || []).forEach(score => {
        if (clusterMap[score.cluster_id]) {
          clusterMap[score.cluster_id].divergence = score.divergence_score || 0;
        }
      });

      // Add priority scores from AHP results
      (prioritizationResults || []).forEach((result, index) => {
        if (clusterMap[result.cluster_id]) {
          clusterMap[result.cluster_id].priority = result.priority_score || result.score || (10 - index); // fallback priority based on rank
        }
      });

      const processedClusters = Object.values(clusterMap);

      // Create activity feed from recent data
      const activityFeed = [];
      
      // Add submissions activity
      if (submissions && submissions.length > 0) {
        const recentSubmissions = submissions.filter(s => 
          new Date() - new Date(s.created_at) < 24 * 60 * 60 * 1000 // last 24 hours
        );
        if (recentSubmissions.length > 0) {
          activityFeed.push({
            type: "submission",
            text: `${recentSubmissions.length} new stakeholder submissions received`,
            time: formatTimeAgo(Math.max(...recentSubmissions.map(s => new Date(s.created_at)))),
            color: "#3b82f6"
          });
        }
      }

      // Add clustering activity
      if (clusters && clusters.length > 0) {
        const latestCluster = clusters.reduce((latest, cluster) => 
          new Date(cluster.created_at) > new Date(latest.created_at) ? cluster : latest
        );
        activityFeed.push({
          type: "cluster",
          text: `Clustering completed — ${clusters.length} groups identified`,
          time: formatTimeAgo(latestCluster.created_at),
          color: "#10b981"
        });
      }

      // Add conflicts activity
      if (conflicts && conflicts.length > 0) {
        const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
        if (highSeverityConflicts.length > 0) {
          const latestConflict = highSeverityConflicts.reduce((latest, conflict) => 
            new Date(conflict.created_at) > new Date(latest.created_at) ? conflict : latest
          );
          activityFeed.push({
            type: "conflict",
            text: `High-severity conflict detected: ${latestConflict.description || 'Conflict identified'}`,
            time: formatTimeAgo(latestConflict.created_at),
            color: "#ef4444"
          });
        }
      }

      // Add NFR activity
      if (nfrs && nfrs.length > 0) {
        const latestNfr = nfrs.reduce((latest, nfr) => 
          new Date(nfr.created_at) > new Date(latest.created_at) ? nfr : latest
        );
        activityFeed.push({
          type: "nfr",
          text: `${nfrs.length} NFRs generated for project`,
          time: formatTimeAgo(latestNfr.created_at),
          color: "#8b5cf6"
        });
      }

      // Add prioritization activity
      if (prioritizationResults && prioritizationResults.length > 0) {
        const latestPrioritization = prioritizationResults.reduce((latest, result) => 
          new Date(result.created_at) > new Date(latest.created_at) ? result : latest
        );
        activityFeed.push({
          type: "prioritization",
          text: "Prioritization completed — Rankings updated",
          time: formatTimeAgo(latestPrioritization.created_at),
          color: "#646cff"
        });
      }

      // Create pipeline stages
      const pipelineStages = [
        { name: "Requirements", icon: "📝", count: submissions ? submissions.length : 0, status: "active" },
        { name: "Clustering", icon: "🔗", count: clusters ? clusters.length : 0, status: clusters && clusters.length > 0 ? "complete" : "pending" },
        { name: "Opinion Mining", icon: "💭", count: divergenceScores ? divergenceScores.length : 0, status: divergenceScores && divergenceScores.length > 0 ? "active" : "pending" },
        { name: "Conflict Detection", icon: "⚠️", count: conflicts ? conflicts.length : 0, status: conflicts && conflicts.some(c => c.severity === 'high') ? "warning" : "complete" },
        { name: "Prioritization", icon: "📊", count: prioritizationResults ? prioritizationResults.length : 0, status: prioritizationResults && prioritizationResults.length > 0 ? "complete" : "pending" }
      ];

      setDashboardData({
        clusters: processedClusters,
        totalSubmissions: submissions ? submissions.length : 0,
        activeConflicts: conflicts ? conflicts.filter(c => c.severity === 'high').length : 0,
        totalNfrs: nfrs ? nfrs.length : 0,
        activityFeed: activityFeed.slice(0, 8), // Limit to 8 recent items
        pipelineStages
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    }

    setLoading(false);
  };

  const handleStageClick = (index) => {
    setHighlightedStage(index === highlightedStage ? null : index);
  };

  const handleQuickAction = (action) => {
    console.log(`Executing: ${action}`);
    // In a real app, this would trigger the actual functionality
  };

  const sortedClusters = [...dashboardData.clusters].sort((a, b) => b.priority - a.priority);
  const maxPriority = dashboardData.clusters.length > 0 ? Math.max(...dashboardData.clusters.map(c => c.priority)) : 10;

  if (loading) {
    return (
      <div className="dashboard-new">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-new">
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={fetchDashboardData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-new ${mounted ? 'mounted' : ''}`}>
      {/* Background Effects */}
      <div className="bg-effects">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
        <div className="rotating-cube"></div>
      </div>

      {/* Hero Stats */}
      <section className="hero-stats">
        <StatCard 
          title="Total Submissions" 
          value={dashboardData.totalSubmissions} 
          icon="📝" 
          delay={0}
        />
        <StatCard 
          title="Requirement Clusters" 
          value={dashboardData.clusters.length} 
          icon="🔗" 
          delay={100}
        />
        <StatCard 
          title="Active Conflicts" 
          value={dashboardData.activeConflicts} 
          icon="⚠️" 
          delay={200}
          showPulse={dashboardData.activeConflicts > 0}
        />
        <StatCard 
          title="NFRs Generated" 
          value={dashboardData.totalNfrs} 
          icon="⚡" 
          delay={300}
        />
      </section>

      {/* Pipeline Visualization */}
      <section className="pipeline-section">
        <h2 className="section-title">Requirements Pipeline</h2>
        <div className="pipeline-container">
          {dashboardData.pipelineStages.map((stage, index) => (
            <div key={stage.name} className="pipeline-item">
              <PipelineStage 
                stage={stage}
                index={index}
                isHighlighted={highlightedStage === index}
                onClick={() => handleStageClick(index)}
              />
              {index < dashboardData.pipelineStages.length - 1 && (
                <div className="pipeline-connector">
                  <div className="connector-line"></div>
                  <div className="connector-arrow">→</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Two Column Layout */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="left-column">
          {/* Cluster Health Heatmap */}
          <section className="heatmap-section">
            <h2 className="section-title">Cluster Health Matrix</h2>
            {dashboardData.clusters.length > 0 ? (
              <>
                <div className="heatmap-grid">
                  {dashboardData.clusters.map((cluster, index) => (
                    <ClusterCell key={cluster.id || cluster.name} cluster={{
                      name: cluster.name,
                      divergence: cluster.divergence,
                      submissions: cluster.submissions,
                      priority: cluster.priority
                    }} index={index} />
                  ))}
                </div>
                <div className="heatmap-legend">
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
                    <span>Low Divergence</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#f59e0b' }}></div>
                    <span>Moderate</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
                    <span>High Divergence</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No clusters available. Run clustering to see cluster health data.</p>
              </div>
            )}
          </section>

          {/* Priority Rankings */}
          <section className="priority-section">
            <h2 className="section-title">Priority Rankings</h2>
            {sortedClusters.length > 0 ? (
              <div className="priority-list">
                {sortedClusters.slice(0, 8).map((cluster, index) => (
                  <PriorityBar 
                    key={cluster.id || cluster.name} 
                    cluster={{
                      name: cluster.name,
                      priority: cluster.priority
                    }} 
                    index={index}
                    maxPriority={maxPriority}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No prioritization data available. Run prioritization to see rankings.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="right-column">
          {/* Recent Activity Feed */}
          <section className="activity-section">
            <h2 className="section-title">Recent Activity</h2>
            <div className="activity-feed">
              {dashboardData.activityFeed.length > 0 ? (
                dashboardData.activityFeed.map((activity, index) => (
                  <ActivityItem key={index} activity={activity} index={index} />
                ))
              ) : (
                <div className="empty-state">
                  <p>No recent activity to display.</p>
                </div>
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="actions-section">
            <h2 className="section-title">Quick Actions</h2>
            <div className="actions-grid">
              <QuickAction 
                title="Run Clustering"
                icon="🔗"
                onClick={() => handleQuickAction('clustering')}
                index={0}
              />
              <QuickAction 
                title="Generate NFRs"
                icon="⚡"
                onClick={() => handleQuickAction('nfrs')}
                index={1}
              />
              <QuickAction 
                title="Analyze Opinions"
                icon="💭"
                onClick={() => handleQuickAction('opinions')}
                index={2}
              />
              <QuickAction 
                title="Prioritize"
                icon="📊"
                onClick={() => handleQuickAction('prioritization')}
                index={3}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardNew;