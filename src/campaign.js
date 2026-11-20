export const TOTAL_NIGHTS = 3;

export function createCampaign() {
  return { night: 1, wins: [] };
}

export function completeNight(campaign, state, score) {
  if (state === 'won') campaign.wins[campaign.night - 1] = score;
  return campaign.wins.reduce((sum, points) => sum + points, 0);
}

export function nextNight(campaign) {
  if (campaign.night >= TOTAL_NIGHTS || campaign.wins[campaign.night - 1] === undefined) return false;
  campaign.night += 1;
  return true;
}
