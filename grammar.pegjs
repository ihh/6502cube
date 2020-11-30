// OldSrc^OldSrcDir OldTgt^OldTgtDir => NewSrc^NewSrcDir NewTgt^NewTgtDir (Weight) : { ... Prolog ... }.


Rules
= _ h:Rule t:Rules { return h.concat(t) }
/ _ h:Rule _ { return h }

Rule
  = s:$OldSource Space t:$OldTarget _ l:TargetedRules { return l.map ((r)=>[s].concat(r)) }
  / s:$OldSource _ l:SelfRules { return l.map ((r)=>[s,null].concat(r)) }

TargetedRules = t:$OldTarget _ l:SelfRules { return l.map ((r)=>[t].concat(r)) }
SelfRules = "=>" _ l:RuleRhsList _ "." { return l }

RuleRhsList
 = _ h:RuleRhs _ "|" t:RuleRhsList { return [h].concat(t) }
 / _ h:RuleRhs _ { return [h] }
 
RuleRhs
 = s:RuleRhsSymbols _ "(" _ w:Number _ ")" { return s.concat(w) }
 / s:RuleRhsSymbols { return s.concat(1) }

RuleRhsSymbols
 = s:$NewSource Space t:$NewTarget { return [s, t] }
 / s:$NewSource { return [s, "$t"] }

OldSource = s:Symbol "^" d:OldSourceDirChar+ { return [s,d] } / s:Symbol { return [s,"0123"] }
OldTarget = s:Symbol "^" d:OldTargetDirChar+ { return [s,d] } / s:Symbol { return [s,"0123"] }
NewSource = s:RhsSymbol "^" d:RhsDirChar+ { return [s,d] } / s:Symbol { return [s,"a"] }
NewTarget = s:RhsSymbol "^" d:RhsDirChar+ { return [s,d] } / s:Symbol { return [s,"w"] }

RhsSymbol = "$s" / "$t" / Symbol

Symbol = h:[a-z_] t:[a-z0-9_]* { return h + t.join('') }
OldSourceDirChar = [0-3]
OldTargetDirChar = [0-3a-d]
RhsDirChar = [0-3a-dw-z]

Number = [0-9]+ / [0-9]+ "." [0-9]*

Space "nonemptyWhitespace"
  = [ \t\n\r]+
  
_ "whitespace"
  = [ \t\n\r]*
