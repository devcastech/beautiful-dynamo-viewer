import { invoke } from '@tauri-apps/api/core';

export function listAwsProfiles(): Promise<string[]> {
  return invoke<string[]>('list_aws_profiles');
}

/** True when the profile has valid credentials (sts get-caller-identity). */
export function checkAwsProfile(profile: string): Promise<boolean> {
  return invoke<boolean>('check_aws_profile', { profile });
}

export function awsSsoLogin(profile: string): Promise<boolean> {
  return invoke<boolean>('aws_sso_login', { profile });
}

/** Rebuild the backend DynamoDB client with this profile/region. */
export function setAwsProfile(profile: string, region: string): Promise<void> {
  return invoke('set_aws_profile', { profile, region });
}
