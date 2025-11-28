import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { UnifiedCommunityView } from '../components/community-hub/UnifiedCommunityView';

export function CommunityHubPage() {
  const [searchParams] = useSearchParams();
  const chatUserId = searchParams.get('chat');
  const isChatOpen = searchParams.get('chatOpen') === 'true' || !!chatUserId;

  return (
    <Layout>
      <div className="page-container community-hub-page">
        <UnifiedCommunityView 
          initialChatOpen={isChatOpen}
          initialChatUserId={chatUserId ?? undefined}
        />
      </div>
    </Layout>
  );
}

