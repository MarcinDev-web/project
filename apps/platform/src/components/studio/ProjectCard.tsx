import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { ProjectTeamShare } from './ProjectTeamShare';
import type { StudioProject, StudioTeam, TeamMember } from '../../api/studio';
import { studioApi } from '../../api/studio';
import '../../styles/studio.css';

interface ProjectCardProps {
  project: StudioProject;
  onDelete: (id: string) => void;
  onPublish?: (id: string) => void;
  team?: StudioTeam | null;
  teamMembers?: TeamMember[];
  isTeamOwner?: boolean;
}

export function ProjectCard({
  project,
  onDelete,
  onPublish,
  team,
  teamMembers = [],
  isTeamOwner = false,
}: ProjectCardProps) {
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [projectAccess, setProjectAccess] = useState<{ access: { accessLevel: string; userId?: string } | null } | null>(
    null
  );

  const handleLoadAccess = async () => {
    try {
      const access = await studioApi.getProjectTeamAccess(project.id);
      setProjectAccess(access);
    } catch (error) {
      console.error('Failed to load project access:', error);
    }
  };

  const handleShowShare = () => {
    if (!showShareDialog) {
      void handleLoadAccess();
    }
    setShowShareDialog(!showShareDialog);
  };

  const handleAccessChanged = () => {
    void handleLoadAccess();
  };

  return (
    <Card hoverable>
      <div className="project-card">
        {project.thumbnailUrl ? (
          <img src={project.thumbnailUrl} alt={project.name} className="project-thumbnail" />
        ) : (
          <div className="project-thumbnail-placeholder">
            <span>📁</span>
          </div>
        )}
        <div className="project-info">
          <h3 className="project-name">{project.name}</h3>
          {project.description && (
            <p className="project-description">{project.description}</p>
          )}
          <div className="project-meta">
            <span className="project-status">
              {project.isPublished ? '✅ Opublikowany' : '📝 Wersja robocza'}
            </span>
            <span className="project-date">
              {new Date(project.updatedAt).toLocaleDateString('pl-PL')}
            </span>
          </div>
          {project.tags && project.tags.length > 0 && (
            <div className="project-tags">
              {project.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="project-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="project-actions">
          <Link to={`/editor?project=${project.id}`} style={{ display: 'contents' }}>
            <Button variant="secondary" style={{ width: '100%' }}>
              Edytuj
            </Button>
          </Link>
          {!project.isPublished && onPublish && (
            <Button
              variant="primary"
              style={{ width: '100%' }}
              onClick={() => onPublish(project.id)}
            >
              Opublikuj
            </Button>
          )}
          {isTeamOwner && team && (
            <Button
              variant="secondary"
              style={{ width: '100%' }}
              onClick={handleShowShare}
            >
              {projectAccess?.access ? 'Zarządzaj' : 'Udostępnij'}
            </Button>
          )}
          <Button
            variant="secondary"
            style={{ width: '100%' }}
            onClick={() => onDelete(project.id)}
          >
            Usuń
          </Button>
        </div>
        {showShareDialog && team && (
          <div className="project-share-dialog">
            <ProjectTeamShare
              projectId={project.id}
              members={teamMembers}
              currentAccess={
                projectAccess?.access
                  ? {
                      projectId: project.id,
                      teamId: team.id,
                      accessLevel: projectAccess.access.accessLevel as 'read' | 'write',
                      ...(projectAccess.access.userId && { userId: projectAccess.access.userId }),
                    }
                  : null
              }
              onAccessChanged={handleAccessChanged}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
