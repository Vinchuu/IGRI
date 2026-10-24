import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { formatTeamWithEmoji } from '../src/utils/emojis.js';
import { TeamGroupService } from '../src/services/TeamGroupService.js';

dotenv.config();

const CHANNEL_ID = '1560713196086755478'; // 〢👽├▹igri channel

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      console.error('Channel not found or cannot send messages');
      process.exit(1);
    }

    const guild = (channel as any).guild;
    const summary = TeamGroupService.getGroupsSummary();

    const mediaDir = 'C:\\Users\\ombha\\.gemini\\antigravity-ide\\brain\\45ef11db-4b15-4e45-9bc9-c862984ac565\\.user_uploaded';

    const attachments = [
      new AttachmentBuilder(path.join(mediaDir, 'media_1792739673691.png'), { name: 'Group_A.png' }),
      new AttachmentBuilder(path.join(mediaDir, 'media_1792739677791.png'), { name: 'Group_B.png' }),
      new AttachmentBuilder(path.join(mediaDir, 'media_1792739681284.png'), { name: 'Group_C.png' }),
      new AttachmentBuilder(path.join(mediaDir, 'media_1792739685323.png'), { name: 'Group_D.png' }),
    ];

    const groupAFormatted = (summary['Group A'] || [])
      .map((t) => `• ${formatTeamWithEmoji(t, guild)}`)
      .join('\n');

    const groupBFormatted = (summary['Group B'] || [])
      .map((t) => `• ${formatTeamWithEmoji(t, guild)}`)
      .join('\n');

    const groupCFormatted = (summary['Group C'] || [])
      .map((t) => `• ${formatTeamWithEmoji(t, guild)}`)
      .join('\n');

    const groupDFormatted = (summary['Group D'] || [])
      .map((t) => `• ${formatTeamWithEmoji(t, guild)}`)
      .join('\n');

    const mainEmbed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`🏆 iGRI SEASON 2 — OFFICIAL FINALS GROUPS 🏆`)
      .setDescription(
        `The battle lines are drawn! **32 elite teams** have been officially seeded into **4 championship groups** for the iGRI Season 2 Finals.\n\n` +
        `📺 **Watch Live on Kick:** [kick.com/soulcity](https://kick.com/soulcity)\n` +
        `⚔️ **Fantasy Arena:** Use \`/predict\` or \`!predict\` to back your favorite teams!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🟢 GROUP A',
          value: groupAFormatted || '*No teams*',
          inline: true,
        },
        {
          name: '🟢 GROUP B',
          value: groupBFormatted || '*No teams*',
          inline: true,
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: false,
        },
        {
          name: '🟢 GROUP C',
          value: groupCFormatted || '*No teams*',
          inline: true,
        },
        {
          name: '🟢 GROUP D',
          value: groupDFormatted || '*No teams*',
          inline: true,
        }
      )
      .setImage('attachment://Group_A.png')
      .setFooter({
        text: 'iGRI Season 2 • SoulCity x Kick • Fantasy Arena Active',
      })
      .setTimestamp();

    const embedB = new EmbedBuilder()
      .setColor('#2ECC71')
      .setImage('attachment://Group_B.png');

    const embedC = new EmbedBuilder()
      .setColor('#2ECC71')
      .setImage('attachment://Group_C.png');

    const embedD = new EmbedBuilder()
      .setColor('#2ECC71')
      .setImage('attachment://Group_D.png');

    console.log('Posting announcement to channel...');
    const message = await (channel as any).send({
      content: `📢 @everyone **iGRI SEASON 2 FINALS GROUPS ARE OFFICIALLY LOCKED!** 🚀🔥`,
      embeds: [mainEmbed, embedB, embedC, embedD],
      files: attachments,
    });

    console.log(`✅ Announcement successfully sent! Message ID: ${message.id}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to post announcement:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
