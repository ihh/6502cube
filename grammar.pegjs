Rules = _ Rule Rules / _ Rule _

Rule = RuleLhs _ "=>" _ RuleRhsList _ ";"

RuleLhs = OldSource Space OldTarget / OldSource
RuleRhsList = _ RuleRhs _ "|" RuleRhsList / _ RuleRhs _
RuleRhs = RuleRhsSymbols _ "(" _ Number _ ")" / RuleRhsSymbols
RuleRhsSymbols = RhsSym Space RhsSym / RhsSym

OldSource = Symbol "^" OldSourceDirChar+ / Symbol
OldTarget = Symbol "^" OldTargetDirChar+ / Symbol
RhsSym = Symbol "^" RhsDirChar+ / Symbol

Symbol = [a-z_] [a-z0-9_]*
OldSourceDirChar = [0-3]
OldTargetDirChar = [0-3a-d]
RhsDirChar = [0-3a-dw-z]

Number = [0-9]+ / [0-9]+ "." [0-9]*

Space "nonemptyWhitespace"
  = [ \t\n\r]+
  
_ "whitespace"
  = [ \t\n\r]*
