const TelegramApi = require("node-telegram-bot-api");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const tg_token = process.env.TG_TOKEN;
const openweather_token = process.env.OPENWEATHER_TOKEN;
const iq_air_token = process.env.IQ_AIR_TOKEN;

let cityName;
let coords;

const bot = new TelegramApi(tg_token, { polling: false });

const icons = {
	mist: "🌫️",
	fog: "🌫️",
	thunderstorm: "🌩",
	drizzle: "🌦",
	rain: "🌧️",
	snow: "🌨️",
	smoke: "😶‍🌫️",
	haze: "😶‍🌫️",
	dust: "💨",
	sand: "💨",
	squall: "💨",
	ash: "🌋",
	tornado: "🌪",
	clear: "☀️",
	clouds: "☁️",
};

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

const options = {
	reply_markup: JSON.stringify({
		resize_keyboard: true,
		keyboard: [
			[
				{
					text: "Текущая погода",
					callback_data: "current_weather",
				},
				{ text: "Получите IQ AIR", callback_data: "get_countries" },
			],
		],
	}),
	parse_mode: "Markdown",
};

const air_pollution_level = (aqi) => {
	if (aqi <= 50) {
		return "🟢 Хороший";
	} else if (aqi >= 51 && aqi <= 100) {
		return "🟡 Умеренный";
	} else if (aqi >= 101 && aqi <= 150) {
		return "🟠 Вредно для чувствительных групп";
	} else if (aqi >= 151 && aqi <= 200) {
		return "🔴 Нездоровый";
	} else if (aqi >= 201 && aqi <= 300) {
		return "🟣 Очень вредно для здоровья";
	} else {
		return "🟤 Опасный";
	}
};

app.get("/", (req, res) => {
	res.send("Telegram Bot is running!");
	res.status(200).json({ message: "Telegram Bot is running!" });
});

app.post(`/${tg_token}`, (req, res) => {
	const { body } = req;
	console.log(body);
	bot.processUpdate(body);
	res.status(200).json({ message: "ok" });
});

const start = () => {
	bot.setMyCommands([
		{ command: "/start", description: "Запусти бота" },
		{ command: "/info", description: "Дает информацию о боте" },
	]);
	bot.on("message", async (msg) => {
		const text = msg.text;
		const chatId = msg.chat.id;
		const messageId = msg.message_id;
		const userId = msg.from.id;

		if (text === "/start") {
			await bot.sendMessage(chatId, "Добро пожаловать в бот!!!", options);
		}
		if (text === "Текущая погода") {
			bot.sendMessage(chatId, "Напишите название города:").then(() => {
				bot.once("message", async (msg) => {
					cityName = msg.text;
					try {
						const response = await fetch(
							`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${openweather_token}&units=metric&lang=ru`,
							{ method: "GET" }
						);
						const data = await response.json();
						coords = data.coord;
						if (!data) {
							return bot.sendMessage(
								chatId,
								"Ошибка при получении данных"
							);
						}
						return bot.sendMessage(
							chatId,
							`🌆 Текущий город: ${data.name}\n🌤 Погода: ${
								data?.weather[0]?.description
							}\n🌄 Иконка: ${
								icons[data?.weather[0]?.main.toLowerCase()]
							}\n🌡️ Температура: ${
								data.main.temp
							}°C\n🤒 Ощущается как: ${
								data.main.feels_like
							}°C\n⏱ Давление: ${
								data.main.pressure
							} hPa \n🫧 Влажность: ${
								data.main.humidity
							} % \n👁️Видимость: ${data.visibility} m `
						);
					} catch (error) {
						console.error("Error fetching weather:", error.message);
						return bot.sendMessage(
							chatId,
							"Ошибка при получении погоды"
						);
					}
				});
			});
		}
		if (text === "Получите IQ AIR") {
			bot.sendMessage(
				chatId,
				"Отправьте мне ваше текущее местоположение чтобы узнать качество воздуха. Отправив местоположение, вы сможете точно увидеть результат"
			);

			// bot.once("message", async (msg) => {
			// 	cityName = msg.text;
			// 	try {
			// 		const response = await fetch(
			// 			`https://api.waqi.info/feed/${cityName}/?token=${iq_air_token}`
			// 		);
			// 		const data = await response.json();
			// 		if (!data) {
			// 			return bot.sendMessage(
			// 				chatId,
			// 				"Ошибка при получении данных"
			// 			);
			// 		}
			// 		console.log(data);
			// 		return bot.sendMessage(chatId, showAirPollution(data), {
			// 			parse_mode: "Markdown",
			// 		});
			// 	} catch (error) {
			// 		console.error("Error fetching weather:", error.message);
			// 		return bot.sendMessage(
			// 			chatId,
			// 			"Ошибка при получении данных"
			// 		);
			// 	}
			// });
			bot.once("location", async (location) => {
				try {
					const response = await fetch(
						`https://api.waqi.info/feed/geo:${location.location.latitude};
						${location.location.longitude}/?token=${iq_air_token}`
					);
					const data = await response.json();
					if (!data) {
						return bot.sendMessage(
							chatId,
							"Ошибка при получении данных"
						);
					}
					return bot.sendMessage(
						chatId,
						`
					🌬️ Air IQ:  ${data.data.aqi}\n📈 Статус: ${air_pollution_level(
							data.data.aqi
						)} \n📊 PM2.5: ${data.data.iaqi.pm25.v} мкг/м3
				`,
						{
							parse_mode: "Markdown",
						}
					);
				} catch (error) {
					console.error("Error fetching weather:", error.message);
					return bot.sendMessage(
						chatId,
						"Ошибка при получении данных"
					);
				}
			});
		}
	});
};
// bot.setWebHook(
// 	`https://weather-telegram-app-b31d5d394ce0.herokuapp.com/${tg_token}`
// );

bot.setWebHook(
	`https://weather-telegram-bot-tr1u.onrender.com/${tg_token}`
);

start();

app.listen(port, () => {
	console.log(`Telegram bot server is running on port ${port}`);
});
