; Maelstrom VTT hosts the table for LAN and internet players, so Windows
; Firewall would ask about it the first time it hosts. The installer allows
; the installed app in, once, and the uninstaller takes the rule away again.
; (The app was called Kraken VTT: its old rule is taken away too.)
;
; Art packs: Maelstrom's character and creature art is downloaded, not
; installed. A page before the install asks which packs to get (a box each,
; Select all / Select none); after the install the ticked ones not already
; there are downloaded into Documents\Kraken VTT\Art Packs, where Maelstrom
; reads them (electron/artPacks.cjs). An update (silent, or --updated) asks
; nothing and downloads nothing: Maelstrom's start screen gets packs later.

!include nsDialogs.nsh
!include LogicLib.nsh

!define ART_URL "https://github.com/krakenunbound/maelstrom-vtt/releases/download/art-packs"

!ifndef BUILD_UNINSTALLER
Var ArtPage
Var ArtMonsters
Var ArtFantasy
Var ArtScifi
Var ArtHorror
Var WantMonsters
Var WantFantasy
Var WantScifi
Var WantHorror

!macro customPageAfterChangeDir
  Page custom ArtPacksShow ArtPacksLeave
!macroend

Function ArtPacksShow
  ${if} ${isUpdated}
    Abort
  ${endif}
  !insertmacro MUI_HEADER_TEXT "Art packs" "Optional portraits and tokens, downloaded now"
  nsDialogs::Create 1018
  Pop $ArtPage
  ${if} $ArtPage == error
    Abort
  ${endif}
  ${NSD_CreateLabel} 0 0 100% 30u "Maelstrom's character and creature art comes as art packs. Tick the ones to download into Documents\Kraken VTT\Art Packs. You can get any of them later from Maelstrom's start screen (Art packs)."
  Pop $0
  ${NSD_CreateCheckbox} 0 34u 100% 12u "Monsters: a portrait and a token for each creature (378 MB)"
  Pop $ArtMonsters
  ${NSD_CreateCheckbox} 0 50u 100% 12u "Fantasy Characters: races and classes for fantasy games, and people's faces (1.1 GB)"
  Pop $ArtFantasy
  ${NSD_CreateCheckbox} 0 66u 100% 12u "Sci-fi Characters: races and classes for science fiction games (135 MB)"
  Pop $ArtScifi
  ${NSD_CreateCheckbox} 0 82u 100% 12u "Horror && Modern Characters: for horror and modern games (31 MB)"
  Pop $ArtHorror
  ${NSD_CreateButton} 0 102u 64u 14u "Select all"
  Pop $0
  ${NSD_OnClick} $0 ArtPacksAll
  ${NSD_CreateButton} 70u 102u 64u 14u "Select none"
  Pop $0
  ${NSD_OnClick} $0 ArtPacksNone
  ; Back to this page: as it was left.
  ${NSD_SetState} $ArtMonsters $WantMonsters
  ${NSD_SetState} $ArtFantasy $WantFantasy
  ${NSD_SetState} $ArtScifi $WantScifi
  ${NSD_SetState} $ArtHorror $WantHorror
  nsDialogs::Show
FunctionEnd

Function ArtPacksAll
  ${NSD_Check} $ArtMonsters
  ${NSD_Check} $ArtFantasy
  ${NSD_Check} $ArtScifi
  ${NSD_Check} $ArtHorror
FunctionEnd

Function ArtPacksNone
  ${NSD_Uncheck} $ArtMonsters
  ${NSD_Uncheck} $ArtFantasy
  ${NSD_Uncheck} $ArtScifi
  ${NSD_Uncheck} $ArtHorror
FunctionEnd

Function ArtPacksLeave
  ${NSD_GetState} $ArtMonsters $WantMonsters
  ${NSD_GetState} $ArtFantasy $WantFantasy
  ${NSD_GetState} $ArtScifi $WantScifi
  ${NSD_GetState} $ArtHorror $WantHorror
FunctionEnd

; One pack: downloaded beside its place (.part), named when whole; one already there is kept.
!macro ArtPackGet WANT FILE TITLE
  ${if} ${WANT} == ${BST_CHECKED}
    ${ifNot} ${FileExists} "$PROFILE\Documents\Kraken VTT\Art Packs\${FILE}"
      DetailPrint "Downloading the ${TITLE} art pack..."
      inetc::get /CAPTION "${TITLE} art pack" /RESUME "" "${ART_URL}/${FILE}" "$PROFILE\Documents\Kraken VTT\Art Packs\${FILE}.part" /END
      Pop $0
      ${if} $0 == "OK"
        Rename "$PROFILE\Documents\Kraken VTT\Art Packs\${FILE}.part" "$PROFILE\Documents\Kraken VTT\Art Packs\${FILE}"
      ${else}
        Delete "$PROFILE\Documents\Kraken VTT\Art Packs\${FILE}.part"
        DetailPrint "The ${TITLE} art pack did not download ($0). Get it later from Maelstrom's start screen."
      ${endif}
    ${else}
      DetailPrint "The ${TITLE} art pack is already there."
    ${endif}
  ${endif}
!macroend
!endif

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Kraken VTT"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="${PRODUCT_NAME}" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=any description="Players joining your ${PRODUCT_NAME} table"'
  ${ifNot} ${Silent}
  ${andIfNot} ${isUpdated}
    CreateDirectory "$PROFILE\Documents\Kraken VTT\Art Packs"
    !insertmacro ArtPackGet $WantMonsters "Maelstrom-Art-Monsters.kpack" "Monsters"
    !insertmacro ArtPackGet $WantFantasy "Maelstrom-Art-Fantasy-Characters.kpack" "Fantasy Characters"
    !insertmacro ArtPackGet $WantScifi "Maelstrom-Art-Scifi-Characters.kpack" "Sci-fi Characters"
    !insertmacro ArtPackGet $WantHorror "Maelstrom-Art-Horror-Modern-Characters.kpack" "Horror & Modern Characters"
  ${endif}
!macroend

!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="${PRODUCT_NAME}"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Kraken VTT"'
!macroend
