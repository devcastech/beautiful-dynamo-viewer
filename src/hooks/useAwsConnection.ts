import { useEffect, useState } from 'react';
import { awsSsoLogin, checkAwsProfile, listAwsProfiles, setAwsProfile } from '../services/aws.ts';
import { isTauriRuntime } from '../services/runtime.ts';

export type AwsAuthStatus = 'idle' | 'checking' | 'authed' | 'unauthed';

export const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-south-1', 'sa-east-1',
];

/** AWS profile/region selection and SSO auth state for the backend client. */
export function useAwsConnection() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<string | null>(null);
  const [region, setRegion] = useState('us-east-1');
  const [status, setStatus] = useState<AwsAuthStatus>('idle');

  useEffect(() => {
    if (!isTauriRuntime()) return;
    listAwsProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  async function activate(nextProfile: string, nextRegion: string) {
    setStatus('checking');
    try {
      if (!(await checkAwsProfile(nextProfile))) {
        setStatus('unauthed');
        return;
      }
      await setAwsProfile(nextProfile, nextRegion);
      setStatus('authed');
    } catch {
      setStatus('unauthed');
    }
  }

  return {
    profiles,
    profile,
    region,
    status,
    connected: status === 'authed',

    async selectProfile(next: string) {
      if (!next) return;
      setProfile(next);
      await activate(next, region);
    },

    async selectRegion(next: string) {
      setRegion(next);
      // Re-point the backend client when already connected.
      if (profile && status === 'authed') await activate(profile, next);
    },

    async ssoLogin() {
      if (!profile) return;
      setStatus('checking');
      try {
        await awsSsoLogin(profile);
        await activate(profile, region);
      } catch {
        setStatus('unauthed');
      }
    },
  };
}

export type AwsConnection = ReturnType<typeof useAwsConnection>;
