# Enhanced Conditions migration — dry run

Generated 2026-08-03T02:34:54.410Z

Persona source: none supplied — persona reconciliation was skipped.

| Metric | Value |
| --- | --- |
| Conditions parsed from CDO | 826 |
| Condition templates generated | 826 |
| Condition types generated | 2 |
| Distinct ACL profiles | 87 |
| ACL profiles used by one condition | 48 |
| Distinct persona names referenced | 90 |
| Persona names not matched | 90 |
| Conditions referencing a missing persona | 826 |
| Permission lists granting access to nobody | 9084 of 9084 |
| Automatic fixes applied | 125 |
| Items needing a decision | 27 |

## Needs a decision

### duplicate description (17)

- {"codes":["COLL011","UWAOL5"],"categories":["Ops/Collateral","UW/Attorney Opinion Letter"],"description":"Provide current proof of acceptable professional liability insurance coverage with claim filing instructions for attorney or law firm."}
- {"codes":["COLL017","COLL710","COLL713"],"categories":["Ops/Collateral"],"description":"Security Instrument is a non-MOM document. Provide recorded assignment from seller to MERS."}
- {"codes":["COLL704","COLL711"],"categories":["Ops/Collateral"],"description":"The Deed of Trust is missing (page 2 through 3 or missing Condo rider or missing PUD rider etc.). provide a complete certified deed of trust including legal des"}
- {"codes":["COND001","UWAPPR13"],"categories":["Ops/Mortgage Insurance","UW/Appraisal"],"description":"Provide a copy of the CPM (condo project manager) printout or the AmeriHome lender full review condo project eligibility certification form for condo project re"}
- {"codes":["EH008","EH009"],"categories":["Ops/Appraisal"],"description":"This loan has been identified as an escrow holdback. Provide photos of completed improvements documents. Provide this required document by escrow holdback end d"}
- {"codes":["EH012","EH013","EH014"],"categories":["Ops/Appraisal"],"description":"This loan has been identified as an escrow holdback. Provide the final title report or endorsement to show: a. No outstanding mechanic's liens b. Must not take "}
- {"codes":["EH13","ESHO007"],"categories":["Ops/ESHB"],"description":"Provide Final Title Report or Endorsement."}
- {"codes":["EH14","ESHO008"],"categories":["Ops/ESHB"],"description":"Provide Photos for Certification of Completion."}
- {"codes":["EH15","ESHO009"],"categories":["Ops/ESHB"],"description":"Provide HUD 92300 - Assurance of Completion (Lender)."}
- {"codes":["EH16","ESHO010"],"categories":["Ops/ESHB"],"description":"Provide HUD 92051 - Compliance Inspection Report (Appraiser)."}
- {"codes":["EH17","ESHO011"],"categories":["Ops/ESHB"],"description":"Provide VA 26-1839 - Compliance Inspection Report (Appraiser)."}
- {"codes":["NOT250","UWAGE03"],"categories":["Ops/Collateral","UW/Risk"],"description":"Loan is aged due to the Note date to delivery date is greater than 45 days. Provide a letter of explanation with supporting documentation for the aged loan."}
- {"codes":["OPSRISK02","UWRISK02"],"categories":["Ops/Income","UW/Risk"],"description":"Loan has been submitted for an AmeriHome exception review due to ____________. No further action on your part is required. Please allow 24-48 hours for a final "}
- {"codes":["QCINC01","QCINC02","QCINC03","QCINC04","QCINC05"],"categories":["QC/Income/Employment"],"description":"Income / Employment 01"}
- {"codes":["QCINS01","QCINS02","QCINS03","QCINS04","QCINS05"],"categories":["QC/Insurance"],"description":"Description"}
- {"codes":["SUBAPPR01","UWAPPR16"],"categories":["UW/Appraisal"],"description":"Internal appraisal review has been completed and was deemed acceptable with conditions. In order for the loan to be eligible for purchase, appraiser to provide "}
- {"codes":["TRST01","UW158"],"categories":["Ops/Collateral","UW/Title"],"description":"Title is held in a trust. Provide copy of Trust or Certification of Trust as applicable."}

### possible truncated role (7)

- {"value":"OSS - Coll Exception","occurrences":3069,"sampleCodes":["43040","APPR011","APPR03","APPR04","APPR12"]}
- {"value":"Sr. ILQA - Credt Mgr","occurrences":469,"sampleCodes":["APPR32","APPR50","AUS60","AUS61","AUS62"]}
- {"value":"ILQA -Credit Manager","occurrences":185,"sampleCodes":["APPR50","AUS60","AUS61","AUS62","AUS63"]}
- {"value":"Business Intelligenc","occurrences":43,"sampleCodes":["AUS80","BORR156","GOVT119","UWGOV12"]}
- {"value":"Counter Party Risk M","occurrences":42,"sampleCodes":["AUS80","GOVT119","PMI003","UWGOV12"]}
- {"value":"ND Shipper w/o Price","occurrences":120,"sampleCodes":["AUS80","BORR021","BORR023","BORR024","BORR028"]}
- {"value":"Ops Accpount Rep Mgr","occurrences":11,"sampleCodes":["VA300"]}

### corrupt character (1)

- {"code":"GOVARM01","context":"ials rate change date. Based on the loan�s timing, the current first-rate change"}

### merged role names (1)

- {"value":"Post Purchase MgrSr. Ops Manager","occurrences":1,"sampleCodes":["AUS70"]}

### possible abbreviation (1)

- {"short":"MISC","long":"Miscellaneous"}

## Applied automatically

### code casing (86)

- {"legacyCode":"Borr002","code":"BORR002"}
- {"legacyCode":"Borr003","code":"BORR003"}
- {"legacyCode":"Borr004","code":"BORR004"}
- {"legacyCode":"Borr006","code":"BORR006"}
- {"legacyCode":"Borr012","code":"BORR012"}
- {"legacyCode":"Borr013","code":"BORR013"}
- {"legacyCode":"Borr014","code":"BORR014"}
- {"legacyCode":"Borr015","code":"BORR015"}
- {"legacyCode":"Borr016","code":"BORR016"}
- {"legacyCode":"Borr017","code":"BORR017"}
- {"legacyCode":"Borr018","code":"BORR018"}
- {"legacyCode":"Borr019","code":"BORR019"}
- {"legacyCode":"Borr020","code":"BORR020"}
- {"legacyCode":"Borr1002","code":"BORR1002"}
- {"legacyCode":"Borr1003","code":"BORR1003"}
- {"legacyCode":"Borr12","code":"BORR12"}
- {"legacyCode":"Coll006","code":"COLL006"}
- {"legacyCode":"Coll008","code":"COLL008"}
- {"legacyCode":"Coll009","code":"COLL009"}
- {"legacyCode":"Coll012","code":"COLL012"}
- {"legacyCode":"Disastr1","code":"DISASTR1"}
- {"legacyCode":"Disc001","code":"DISC001"}
- {"legacyCode":"Disc002","code":"DISC002"}
- {"legacyCode":"Disc003","code":"DISC003"}
- {"legacyCode":"Gen002","code":"GEN002"}
- _...61 more, see data-quality-report.json_

### stage spelling (35)

- {"code":"BORR01","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR02","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR03","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR032","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR04","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR08","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR09","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR101","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR133","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR144","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR168","from":"Pre Purc","to":"Pre-Purchase"}
- {"code":"BORR169","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR177","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR211","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR222","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR233","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR244","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR255","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR266","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR277","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR288","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR299","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR303","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR311","from":"Pre Purchase","to":"Pre-Purchase"}
- {"code":"BORR322","from":"Pre Purchase","to":"Pre-Purchase"}
- _...10 more, see data-quality-report.json_

### role artifact (2)

- {"value":"Compliance Manager.","cleaned":"Compliance Manager","occurrences":19,"sampleCodes":["COMP06","COMP07","COMP08","COMP09","COMP10"]}
- {"value":"=Task Manager","cleaned":"Task Manager","occurrences":5,"sampleCodes":["ESHO007","ESHO008","ESHO009","ESHO010","ESHO011"]}

### subcategory spelling (1)

- {"canonical":"Nrtc","collapsed":[{"name":"NRTC","count":1}]}

### role spelling (1)

- {"canonical":"Sr. Ops Manager","collapsed":[{"name":"Sr. OPS Manager","count":11}]}

## ACL profiles

Enhanced Conditions has no per-condition ACL. Each profile below is a persona access
pattern to configure once in Encompass admin, replacing the per-condition role lists.

| Profile | Conditions | Add | Waive |
| --- | --- | --- | --- |
| ACL-001 | 163 | 19 personas | 21 personas |
| ACL-002 | 112 | 5 personas | 7 personas |
| ACL-003 | 69 | 5 personas | 7 personas |
| ACL-004 | 45 | 2 personas | 2 personas |
| ACL-005 | 44 | 12 personas | 12 personas |
| ACL-006 | 38 | 7 personas | 9 personas |
| ACL-007 | 29 | 19 personas | 21 personas |
| ACL-008 | 28 | 19 personas | 21 personas |
| ACL-009 | 23 | 5 personas | 5 personas |
| ACL-010 | 21 | 5 personas | 5 personas |
| ACL-011 | 20 | 20 personas | 22 personas |
| ACL-012 | 20 | 37 personas | 36 personas |
| ACL-013 | 19 | 4 personas | 2 personas |
| ACL-014 | 17 | 4 personas | 4 personas |
| ACL-015 | 13 | 20 personas | 22 personas |
| ACL-016 | 10 | 11 personas | 13 personas |
| ACL-017 | 9 | 7 personas | 7 personas |
| ACL-018 | 8 | 15 personas | 15 personas |
| ACL-019 | 7 | 24 personas | 24 personas |
| ACL-020 | 6 | 22 personas | 24 personas |
| ACL-021 | 6 | 19 personas | 21 personas |
| ACL-022 | 5 | 37 personas | 39 personas |
| ACL-023 | 5 | 36 personas | 36 personas |
| ACL-024 | 5 | 22 personas | 24 personas |
| ACL-025 | 5 | 3 personas | 10 personas |
| _...62 more_ | | | |

## Persona reconciliation

Skipped — no persona list supplied. Re-run with `--personas` once you have
`GET /encompass/v3/settings/personas` saved to disk.

