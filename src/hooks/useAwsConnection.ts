import { useEffect, useRef, useState } from 'react';
import { awsSsoLogin, checkAwsProfile, listAwsProfiles, setAwsProfile } from '../services/aws.ts';
import { isTauriRuntime } from '../services/runtime.ts';

export type AwsAuthStatus = 'idle' | 'checking' | 'authed' | 'unauthed';

const PROFILE_KEY = 'dynamo-viewer.aws.profile';
const REGION_KEY = 'dynamo-viewer.aws.region';
const DEFAULT_REGION = 'us-east-1';

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
  const [region, setRegion] = useState(() => localStorage.getItem(REGION_KEY) ?? DEFAULT_REGION);
  const [status, setStatus] = useState<AwsAuthStatus>('idle');

  useEffect(() => {
    if (!isTauriRuntime()) return;
    listAwsProfiles()
      .then((list) => {
        setProfiles(list);
        // Restore and re-activate the last profile used, if it still exists.
        const saved = localStorage.getItem(PROFILE_KEY);
        if (saved && list.includes(saved)) {
          setProfile(saved);
          void activate(saved, localStorage.getItem(REGION_KEY) ?? DEFAULT_REGION);
        }
      })
      .catch(() => setProfiles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bumped on every activation; stale activations see a newer id and stop
  // touching state, so rapid profile/region switches can't finish out of order
  // and report a status that doesn't match the backend client.
  const activationSeq = useRef(0);

  async function activate(nextProfile: string, nextRegion: string) {
    const seq = ++activationSeq.current;
    const isCurrent = () => activationSeq.current === seq;
    setStatus('checking');
    try {
      const ok = await checkAwsProfile(nextProfile);
      if (!isCurrent()) return;
      if (!ok) {
        setStatus('unauthed');
        return;
      }
      await setAwsProfile(nextProfile, nextRegion);
      if (isCurrent()) setStatus('authed');
    } catch {
      if (isCurrent()) setStatus('unauthed');
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
      localStorage.setItem(PROFILE_KEY, next);
      await activate(next, region);
    },

    async selectRegion(next: string) {
      setRegion(next);
      localStorage.setItem(REGION_KEY, next);
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
