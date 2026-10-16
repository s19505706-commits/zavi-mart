export type PakCity = {
  city: string;
  province: string;
  label: string;
};

const cityEntries: Array<[string, string]> = [
  ["Ahmedpur East", "Punjab"], ["Arifwala", "Punjab"], ["Attock", "Punjab"],
  ["Bahawalnagar", "Punjab"], ["Bahawalpur", "Punjab"], ["Bhakkar", "Punjab"],
  ["Bhalwal", "Punjab"], ["Burewala", "Punjab"], ["Chakwal", "Punjab"],
  ["Chichawatni", "Punjab"], ["Chiniot", "Punjab"], ["Chishtian", "Punjab"],
  ["Daska", "Punjab"], ["Dera Ghazi Khan", "Punjab"], ["Dipalpur", "Punjab"],
  ["Faisalabad", "Punjab"], ["Ferozewala", "Punjab"], ["Gojra", "Punjab"],
  ["Gujranwala", "Punjab"], ["Gujrat", "Punjab"], ["Hafizabad", "Punjab"],
  ["Haroonabad", "Punjab"], ["Hasilpur", "Punjab"], ["Jaranwala", "Punjab"],
  ["Jhang", "Punjab"], ["Jhelum", "Punjab"], ["Kamalia", "Punjab"],
  ["Kamoke", "Punjab"], ["Kasur", "Punjab"], ["Khanewal", "Punjab"],
  ["Khanpur", "Punjab"], ["Kharian", "Punjab"], ["Khushab", "Punjab"],
  ["Kot Addu", "Punjab"], ["Lahore", "Punjab"], ["Layyah", "Punjab"],
  ["Lodhran", "Punjab"], ["Mandi Bahauddin", "Punjab"], ["Mian Channu", "Punjab"],
  ["Mianwali", "Punjab"], ["Multan", "Punjab"], ["Murree", "Punjab"],
  ["Muzaffargarh", "Punjab"], ["Narowal", "Punjab"], ["Nowshera Virkan", "Punjab"],
  ["Okara", "Punjab"], ["Pakpattan", "Punjab"], ["Pattoki", "Punjab"],
  ["Rahim Yar Khan", "Punjab"], ["Rajanpur", "Punjab"], ["Rawalpindi", "Punjab"],
  ["Sadiqabad", "Punjab"], ["Sahiwal", "Punjab"], ["Sambrial", "Punjab"],
  ["Sargodha", "Punjab"], ["Shakargarh", "Punjab"], ["Sheikhupura", "Punjab"],
  ["Shujabad", "Punjab"], ["Sialkot", "Punjab"], ["Toba Tek Singh", "Punjab"],
  ["Vehari", "Punjab"],
  ["Badin", "Sindh"], ["Dadu", "Sindh"], ["Ghotki", "Sindh"],
  ["Hyderabad", "Sindh"], ["Jacobabad", "Sindh"], ["Karachi", "Sindh"],
  ["Khairpur", "Sindh"], ["Larkana", "Sindh"], ["Mirpur Khas", "Sindh"],
  ["Moro", "Sindh"], ["Nawabshah", "Sindh"], ["Sanghar", "Sindh"],
  ["Shikarpur", "Sindh"], ["Sukkur", "Sindh"], ["Tando Adam", "Sindh"],
  ["Thatta", "Sindh"], ["Umerkot", "Sindh"],
  ["Abbottabad", "Khyber Pakhtunkhwa"], ["Bannu", "Khyber Pakhtunkhwa"],
  ["Charsadda", "Khyber Pakhtunkhwa"], ["Dera Ismail Khan", "Khyber Pakhtunkhwa"],
  ["Hangu", "Khyber Pakhtunkhwa"], ["Haripur", "Khyber Pakhtunkhwa"],
  ["Jamrud", "Khyber Pakhtunkhwa"], ["Karak", "Khyber Pakhtunkhwa"],
  ["Kohat", "Khyber Pakhtunkhwa"], ["Lakki Marwat", "Khyber Pakhtunkhwa"],
  ["Mardan", "Khyber Pakhtunkhwa"], ["Mingora", "Khyber Pakhtunkhwa"],
  ["Nowshera", "Khyber Pakhtunkhwa"], ["Peshawar", "Khyber Pakhtunkhwa"],
  ["Swabi", "Khyber Pakhtunkhwa"], ["Timergara", "Khyber Pakhtunkhwa"],
  ["Torkham", "Khyber Pakhtunkhwa"],
  ["Awaran", "Balochistan"], ["Chaman", "Balochistan"], ["Dera Murad Jamali", "Balochistan"],
  ["Gwadar", "Balochistan"], ["Hub", "Balochistan"], ["Kalat", "Balochistan"],
  ["Khuzdar", "Balochistan"], ["Loralai", "Balochistan"], ["Mastung", "Balochistan"],
  ["Quetta", "Balochistan"], ["Sibi", "Balochistan"], ["Turbat", "Balochistan"],
  ["Zhob", "Balochistan"],
  ["Islamabad", "Islamabad Capital Territory"],
  ["Muzaffarabad", "Azad Jammu and Kashmir"], ["Mirpur", "Azad Jammu and Kashmir"],
  ["Kotli", "Azad Jammu and Kashmir"], ["Rawalakot", "Azad Jammu and Kashmir"],
  ["Bagh", "Azad Jammu and Kashmir"], ["Bhimber", "Azad Jammu and Kashmir"],
  ["Gilgit", "Gilgit-Baltistan"], ["Skardu", "Gilgit-Baltistan"],
  ["Chilas", "Gilgit-Baltistan"], ["Hunza", "Gilgit-Baltistan"],
  ["Gahkuch", "Gilgit-Baltistan"]
];

export const PAK_CITIES: PakCity[] = cityEntries
  .map(([city, province]) => ({ city, province, label: `${city}-${province}` }))
  .sort((left, right) => left.label.localeCompare(right.label));
