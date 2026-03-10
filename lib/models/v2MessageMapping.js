const quickdialSentence = '- call Floodline on 0345 988 1188, using quickdial code {{ quickdialNumber }}'

const extreme = {
  severity: 'Extreme',
  description: 'Severe Flood Warning',
  headline: 'Danger to life',
  impact: 'Danger to life - act now',
  instruction: `Act now - danger to life 
 
You should: 
 
- call 999 if you are in immediate danger 

- go to Check for flooding for a map of the area and to monitor up-to-date local flood information – https://check-for-flooding.service.gov.uk/target-area/{{ fwisCode }}  
- act on your personal flood plan if you have one - https://www.gov.uk/government/publications/personal-flood-plan 
- follow the guidance in 'What to do before or during a flood' - https://www.gov.uk/help-during-flood  
 
You can also read more about what severe flood warnings are – https://www.gov.uk/guidance/flood-alerts-and-warnings-what-they-are-and-what-to-do#severe-flood-warning 
 
Stay up to date 
 
To get the latest flood information, you can: 
 
- go to Check for flooding 
- monitor local weather, news and travel updates 
{{ quickdialSentence }}`,
  awarenessLevel: '4; red; Extreme',
  quickdialSentence
}

module.exports = {
  Minor: {
    severity: 'Minor',
    description: 'Flood Alert',
    headline: 'Flooding is possible',
    impact: 'Flooding is possible - be prepared',
    instruction: `Be prepared 
 
You should: 
 
- go to Check for flooding for a map of the area and to monitor up-to-date local flood information – https://check-for-flooding.service.gov.uk/target-area/{{ fwisCode }}  
- get ready to act on your personal flood plan if you have one - https://www.gov.uk/government/publications/personal-flood-plan 
- follow the guidance in 'What to do before or during a flood' - https://www.gov.uk/help-during-flood  
 
You can also read more about what flood alerts are – https://www.gov.uk/guidance/flood-alerts-and-warnings-what-they-are-and-what-to-do#flood-alert 
 
Stay up to date 
 
To get the latest flood information, you can: 
 
- go to Check for flooding 
- monitor local weather, news and travel updates
{{ quickdialSentence }}`,
    awarenessLevel: '1; green; Minor',
    quickdialSentence
  },
  Moderate: {
    severity: 'Severe',
    description: 'Flood Warning',
    headline: 'Flooding is expected',
    impact: 'Flooding is expected - act now',
    instruction: `Act now 
 
You should: 
 
- go to Check for flooding for a map of the area and to monitor up-to-date local flood information – https://check-for-flooding.service.gov.uk/target-area/{{ fwisCode }}  
- act on your personal flood plan if you have one - https://www.gov.uk/government/publications/personal-flood-plan 
- follow the guidance in 'What to do before or during a flood' - https://www.gov.uk/help-during-flood  
 
You can also read more about what flood warnings are – https://www.gov.uk/guidance/flood-alerts-and-warnings-what-they-are-and-what-to-do#flood-warning 
 
Stay up to date 
 
To get the latest flood information, you can: 
 
- go to Check for flooding 
- monitor local weather, news and travel updates 
{{ quickdialSentence }}`,
    awarenessLevel: '3; orange; Severe',
    quickdialSentence
  },
  Severe: extreme,
  Extreme: extreme
}
