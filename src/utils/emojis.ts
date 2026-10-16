import { Guild } from 'discord.js';

/**
 * Known custom server emojis for iGRI tournament teams in VC Hangout
 */
export const TEAM_EMOJIS: Record<string, string> = {
  'NXT8': '<:NXT8:1560698029701468210>',
  'No Rules': '<:NoRules:1560697704412348507>',
  'REDLINE': '<:RedLine:1560697302946029670>',
  'Redline': '<:RedLine:1560697302946029670>',
  'Washed out': '<:WashedOut:1560697930980007966>',
  'Mangalyaan': '<:Mangalyan:1560697876685000765>',
  'Red network': '<:RedNetwork:1560697571972878436>',
  'Pew Pew': '<:PewPew:1560697803116646512>',
  'Guns n roses': '<:GunsnRoses:1560697744195190914>',
  'Guns N Roses': '<:GunsnRoses:1560697744195190914>',
  'Sayless': '<:SayLess:1560697686435434617>',
  'Say Less': '<:SayLess:1560697686435434617>',
  'Black reign': '<:BlackReign:1560697637580316824>',
  'Black Reign': '<:BlackReign:1560697637580316824>',
  'Pookie.Exe': '<:Pookie:1560703420573294754>',
  'Wardogs': '<:WarDogs:1560697537457819698>',
  'WarDogs': '<:WarDogs:1560697537457819698>',
  'No limit': '<:NoLimit:1560697501802168340>',
  'No Limit': '<:NoLimit:1560697501802168340>',
  'Sapola': '<:Sapola:1560697279206264852>',
  '1Invictuz': '<:1Z:1560687464643829943>',
  '1nvictuz': '<:1Z:1560687464643829943>',
  'Silent trigger': '<:ST:1560687425708101733>',
  'Silent Trigger': '<:ST:1560687425708101733>',
  '2Fast': '<:2Fast:1560687385723801700>',
  'W Esports': '<:W_Esports:1560705981804187689>',
  'Team Healers': '<:TeamHealers:1560687351653601340>',
  'Underlords': '<:UnderLords:1560687310318608534>',
  'Nothing2lose': '<:N2L:1560687270804332564>',
  'Kalyug': '<:Kalyug:1560687233252458526>',
  'Wz Demons': '<:WZD:1560687183894155304>',
  'WZ Demons': '<:WZD:1560687183894155304>',
  'Team rip': '<:RIP:1560687147231481897>',
  'Team RIP': '<:RIP:1560687147231481897>',
  'Just chill': '<:JC:1560687113098371303>',
  'Just Chill': '<:JC:1560687113098371303>',
  'Team og': '<:OG:1560687076314325023>',
  'Team OG': '<:OG:1560687076314325023>',
  'Phantoms': '<:Phantoms:1560687041476559051>',
  'Whiffgods': '<:Wiffgods:1560687006231830658>',
  'We gucci': '<:WEG:1560686958169038908>',
  'We Gucci': '<:WEG:1560686958169038908>',
  'Onlypanic': '<:OP:1560686926988705792>',
  'Skillz': '<:Skillz:1560686898278699048>',
  'The escapers': '<:Escapers:1560686870248165499>',
  'The Escapers': '<:Escapers:1560686870248165499>',
  'Death brigade': '<:DB:1560686842318291014>',
  'Team bbg': '<:BBG:1560686784885686352>',
  'Team BBG': '<:BBG:1560686784885686352>',
  'Ravenx': '<:RavenX:1560686759723933756>',
  'Santra Esports': '<:Santra:1560686731676745808>',
  'Goat protocol': '<:GP:1560686706791948318>',
  'Goat Protocol': '<:GP:1560686706791948318>',
  'Early eliminators': '<:EE:1560686678639775824>',
  'Early Eliminators': '<:EE:1560686678639775824>',
  'Code 999': '<:Code999:1560686650181558302>',
  'The final dispatch': '<:TFD:1560686615670558842>',
  'The Final Dispatch': '<:TFD:1560686615670558842>',
  'Zero plans': '<:ZP:1560686587409465515>',
  'Zero Plans': '<:ZP:1560686587409465515>',
  'Low fps': '<:LFS:1560686536532557915>',
  'Low FPS': '<:LFS:1560686536532557915>',
  'Road killers': '<:RK:1560686460028457121>',
  'Road Killers': '<:RK:1560686460028457121>',
};

/**
 * Returns formatted team name with its custom Discord server emoji if available
 */
export function formatTeamWithEmoji(teamName: string, guild?: Guild): string {
  // Check predefined map first
  const normalized = Object.keys(TEAM_EMOJIS).find(
    (k) => k.toLowerCase().trim() === teamName.toLowerCase().trim()
  );
  if (normalized && TEAM_EMOJIS[normalized]) {
    return `${TEAM_EMOJIS[normalized]} **${teamName}**`;
  }

  // Fallback: search in guild emojis
  if (guild) {
    const found = guild.emojis.cache.find(
      (e) => e.name?.toLowerCase().trim() === teamName.toLowerCase().replace(/\s+/g, '').trim()
    );
    if (found) {
      return `${found.toString()} **${teamName}**`;
    }
  }

  return `🛡️ **${teamName}**`;
}
