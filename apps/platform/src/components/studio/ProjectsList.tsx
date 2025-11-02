import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import { ProjectCard } from './ProjectCard';
import type { StudioProject, StudioTeam, TeamMember } from '../../api/studio';
import { studioApi } from '../../api/studio';
import '../../styles/studio.css';

interface ProjectsListProps {
  projects: StudioProject[];
  onDelete: (id: string) => void;
  onPublish?: (id: string) => void;
  loading?: boolean;
}

export function ProjectsList({ projects, onDelete, onPublish, loading }: ProjectsListProps) {
  const [team, setTeam] = useState<StudioTeam | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    void loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      const [teamData, membersData] = await Promise.all([
        studioApi.getTeam().catch(() => null),
        studioApi.getTeamMembers().catch(() => ({ members: [] })),
      ]);
      setTeam(teamData);
      setTeamMembers(membersData.members);
    } catch (error) {
      console.error('Failed to load team data:', error);
    }
  };

  // Check if current user is owner
  const isTeamOwner = team !== null; // If team exists, we're the owner (since getTeam only returns for owner)
  if (loading) {
    return (
      <div className="studio-loading">
        <p>Ładowanie projektów...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <div className="studio-empty">
          <p>Brak projektów. Stwórz swój pierwszy projekt!</p>
          <Link to="/editor">
            <Button variant="primary">Stwórz Projekt</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="projects-grid">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={onDelete}
          {...(onPublish && { onPublish })}
          team={team}
          teamMembers={teamMembers}
          isTeamOwner={isTeamOwner}
        />
      ))}
    </div>
  );
}

