import {
  Client,
  Events,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.login(process.env["DISCORD_TOKEN"]);

const BASE_COMMAND_NAME = "Sort by frequency";

const DIFFERENCES = {
  "1 Hour": 60 * 60 * 1000,
  "1 Day": 24 * 60 * 60 * 1000,
  "10 Days": 10 * 24 * 60 * 60 * 1000,
  "30 Days": 30 * 24 * 60 * 60 * 1000,
};

client.on(Events.ClientReady, async () => {
  console.log("Ready");
});

// Register
/*
client.on(Events.ClientReady, async () => {
  await Promise.all(
    client.guilds.cache.map((guild) => {
      return (async () => {
        await Promise.all(
          (await guild.commands.fetch()).mapValues((command) =>
            command.delete(),
          ),
        );

        await Promise.all(
          Object.entries(DIFFERENCES).map(([type, diff]) => {
            console.log({ type, diff });

            return guild.commands
              .create({
                name: `${BASE_COMMAND_NAME} (${type})`,
                type: ApplicationCommandType.Message,
              })
              .then(console.log)
              .catch(console.error);
          }),
        );
      })();
    }),
  );
});
*/

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.commandName.startsWith(BASE_COMMAND_NAME)) {
    await interaction.deferReply({ ephemeral: true });

    console.log(interaction);

    const interactionGuild = await client.guilds.fetch(interaction.guildId);
    const interactionGuildChannels = await interactionGuild.channels.fetch();
    const interactionChannel = await interactionGuild.channels.fetch(
      interaction.channelId,
    );

    console.log({ permissions: interaction.memberPermissions });
    if (
      !interaction.memberPermissions.has(
        PermissionsBitField.Flags.ManageChannels,
      )
    ) {
      await interaction.followUp({
        content: "Missing Permissions",
        ephemeral: true,
      });
      return;
    }

    console.log({
      interactionGuild,
      interactionGuildChannels,
      interactionChannel,
    });

    const targetChannels = interactionGuildChannels.filter(
      (channel) =>
        channel.parentId === interactionChannel.parentId &&
        channel.type === ChannelType.GuildText,
    );

    console.log({ targetChannels });

    const priorities = new Map();

    const diff = Object.entries(DIFFERENCES)
      .filter(([type, _]) => interaction.commandName.includes(type))
      .map(([_, diff]) => diff);

    console.log(diff);
    const fetchAfterAt = interaction.createdAt.getTime() - diff;

    await Promise.allSettled(
      targetChannels.map(async (channel) => {
        priorities.set(
          channel.id,
          await (async () => {
            if (channel.name.includes("📌") || channel?.topic?.includes("📌"))
              return 10000;
            if (channel.name.includes("🕸") || channel?.topic?.includes("🕸"))
              return -1000;
            return (await channel.messages.fetch({ limit: 100 })).filter(
              (message) => {
                return message.createdAt >= fetchAfterAt;
              },
            ).size;
          })(),
        );
      }),
    )
      .then(console.log)
      .catch(console.error),
      console.log({ priorities });

    targetChannels.sort((a, b) => priorities.get(b.id) - priorities.get(a.id));
    console.log({ targetChannels });

    const positions = [...targetChannels.values()].map((channel, position) => {
      return {
        channel,
        position,
      };
    });

    await interactionGuild.channels
      .setPositions(positions)
      .catch(console.log());

    await interaction.followUp({ content: "Sorted" }).catch(console.log());
  }
});
