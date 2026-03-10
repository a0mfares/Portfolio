/**
 * ProjectAsset
 * Renders a project card inside an inner panel.
 */
function ProjectAsset({ asset }) {
  return (
    <div className="project-asset">
      {asset.preview && (
        <div className="project-preview">
          <img src={asset.preview} alt={`${asset.name} preview`} loading="lazy" />
        </div>
      )}

      <div className="project-meta">
        {asset.date && (
          <div className="project-row">
            <span className="project-key">DATE</span>
            <span className="project-val">{asset.date}</span>
          </div>
        )}
        {asset.techStack && (
          <div className="project-row">
            <span className="project-key">STACK</span>
            <span className="project-val">{asset.techStack}</span>
          </div>
        )}
      </div>

      {asset.description && (
        <>
          <div className="project-divider" />
          <div className="project-desc">{asset.description}</div>
        </>
      )}

      {asset.link && (
        <div className="project-link-wrap">
          <a
            className="project-link"
            href={asset.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            VIEW PROJECT
          </a>
        </div>
      )}
    </div>
  );
}

export default ProjectAsset;
