#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// LCD setup (change 0x27 to 0x3F if needed)
LiquidCrystal_I2C lcd(0x27, 16, 2);

int turbidityPin = A0;
int sensorValue = 0;

// Calibration values (adjust after testing)
int cleanValue = 900;   // value in clean water
int dirtyValue = 300;   // value in dirty water

void setup() {
  lcd.init();
  lcd.backlight();

  Serial.begin(9600);  // for calibration/debug

  lcd.setCursor(0,0);
  lcd.print("Turbidity System");
  delay(2000);
  lcd.clear();
}

void loop() {

  sensorValue = analogRead(turbidityPin);
  Serial.println(sensorValue); // for testing

  // 🛑 Detect air (no water condition)
  if(sensorValue > 950) {
    lcd.setCursor(0,0);
    lcd.print("No Water Detected");
    lcd.setCursor(0,1);
    lcd.print("Insert Sensor    ");
  }
  else {

    // Convert to percentage
    int percentage = map(sensorValue, dirtyValue, cleanValue, 0, 100);
    percentage = constrain(percentage, 0, 100);

    // Display percentage
    lcd.setCursor(0,0);
    lcd.print("Quality: ");
    lcd.print(percentage);
    lcd.print("%   ");

    // Water condition
    lcd.setCursor(0,1);

    if(percentage > 75) {
      lcd.print("Clean Water     ");
    }
    else if(percentage > 40) {
      lcd.print("Cloudy Water    ");
    }
    else {
      lcd.print("Dirty Water     ");
    }
  }

  delay(1000);
}