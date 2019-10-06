(function() {
  "use strict";

  const disablePaymentTableField = paymentTable => {
    paymentTable.forEach(element => {
      element.value["参加者名"].disabled = true;
      element.value["利用合計"].disabled = true;
      element.value["立替金"].disabled = true;
      element.value["自己負担額"].disabled = true;
      element.value["支払額"].disabled = true;
    });
  };

  const disableAjustmentTableField = ajustmentTable => {
    ajustmentTable.forEach(element => {
      element.value["小計_Per"].disabled = true;
    });
  };

  // 支払いテーブルの名簿作成
  const fillPaymentTableParticipant = participant => {
    const paymentTable = participant.map(element => {
      const paymentTableColumn = {
        value: {
          利用合計: { type: "NUMBER", value: undefined, disabled: true },
          参加者名: { type: "USER_SELECT", value: [], disabled: true },
          支払い: { type: "CHECK_BOX", value: [] },
          支払額: { type: "NUMBER", value: undefined, disabled: true },
          立替金: { type: "NUMBER", value: undefined, disabled: true },
          自己負担額: { type: "NUMBER", value: undefined, disabled: true },
          部費負担額: { type: "CALC", value: "" }
        }
      };
      paymentTableColumn.value["参加者名"].value.push({
        code: element.code
      });

      return paymentTableColumn;
    });

    return paymentTable;
  };

  // 精算テーブルのそれぞれの項目一人あたりの料金計算
  const calcAjustmentTablePerCharge = (participantNumber, ajustmentTable) => {
    ajustmentTable.forEach(element => {
      const subtotalCharge = Number.parseInt(element.value["小計"].value, 10);
      const nonpayerNumber = Number.parseInt(
        element.value["非対象者"].value.length,
        10
      );
      const payerNumber = participantNumber - nonpayerNumber;
      const perCharge = Math.round(subtotalCharge / payerNumber);

      element.value["小計_Per"].value = perCharge;
      element.value["小計_Per"].disable = true;
    });
  };

  // 支払いテーブルのそれぞれの人の利用合計を計算
  const calcIndividualPayment = (paymentTable, ajustmentTable) => {
    paymentTable.forEach(paymentElement => {
      // 参加者それぞれのcodeを順に取得
      const payerCode = paymentElement.value["参加者名"].value[0].code;
      let total = 0;
      // 精算テーブルのそれぞれの項目を取得し、その項目の非対象者に上記の参加者が入っていなければtotalに加算
      ajustmentTable.forEach(ajustmentElement => {
        const subtotal = Number.parseInt(
          ajustmentElement.value["小計_Per"].value,
          10
        );
        const nonpayer = ajustmentElement.value["非対象者"].value;
        const doseIncludePayer = element => {
          return element.code === payerCode;
        };
        if (!nonpayer.some(doseIncludePayer)) {
          total += subtotal;
        }
      });
      paymentElement.value["利用合計"].value = total;
    });
  };

  // 自己負担額の計算
  const calcIndividualExpenses = paymentTable => {
    paymentTable.forEach(element => {
      const total = Number.parseInt(element.value["利用合計"].value, 10);
      const subsidy = Number.parseInt(element.value["部費負担額"].value, 10);

      element.value["自己負担額"].value = total - subsidy;
    });
  };

  // 立替金の計算
  const calcIndividualTemporaryPayment = (paymentTable, ajustmentTable) => {
    paymentTable.forEach(paymentElement => {
      // 参加者それぞれのcodeを順に取得
      const payerCode = paymentElement.value["参加者名"].value[0].code;
      let total = 0;
      // 精算テーブルのそれぞれの項目を取得し、その項目の立替者に上記の参加者が入っていなければtotalに加算
      ajustmentTable.forEach(ajustmentElement => {
        const subtotal = Number.parseInt(
          ajustmentElement.value["小計"].value,
          10
        );
        const temporaryPayer = ajustmentElement.value["立替者"].value;
        if (temporaryPayer[0].code === payerCode) {
          total += subtotal;
        }
      });
      paymentElement.value["立替金"].value = total;
    });
  };

  // 支払い額の計算
  const calcIndividualAjustment = paymentTable => {
    paymentTable.forEach(element => {
      const expense = Number.parseInt(element.value["自己負担額"].value, 10);
      const temporary = Number.parseInt(element.value["立替金"].value, 10);

      element.value["支払額"].value = expense - temporary;
    });
  };

  // 部費申請可能額の計算
  const calcLimitSubsidy = (participantNumber, totalCharge) => {
    return Math.min(participantNumber * 5000, totalCharge / 2);
  };

  // 参加人数と支払いテーブル、精算テーブルの編集不可
  kintone.events.on(
    ["app.record.create.show", "app.record.edit.show"],
    event => {
      const record = event.record;
      const participantNumber = record["参加人数"];
      const paymentTable = record["支払いテーブル"].value;
      const ajustmentTable = record["精算テーブル"].value;
      const totalCharge = record["部費利用可能上限"];

      participantNumber.disabled = true;
      disablePaymentTableField(paymentTable);
      disableAjustmentTableField(ajustmentTable);
      totalCharge.disabled = true;

      return event;
    }
  );

  // 参加人数の計算と支払テーブルへの参加者の追加、部費申請可能額の変更
  kintone.events.on(
    ["app.record.create.change.参加者", "app.record.edit.change.参加者"],
    event => {
      const record = event.record;
      const participant = record["参加者"].value;
      const participantNumber = participant.length;
      const totalCharge = Number.parseInt(record["合計"].value, 10);

      record["参加人数"].value = participantNumber;
      record["支払いテーブル"].value = fillPaymentTableParticipant(participant);
      record["部費利用可能上限"].value = calcLimitSubsidy(
        participantNumber,
        totalCharge
      );

      return event;
    }
  );

  // 精算テーブルの小計編集不可
  kintone.events.on(
    [
      "app.record.create.change.精算テーブル",
      "app.record.edit.change.精算テーブル"
    ],
    event => {
      const record = event.record;
      const ajustmentTable = record["精算テーブル"].value;

      disableAjustmentTableField(ajustmentTable);

      return event;
    }
  );

  // 精算テーブル、支払いテーブルの自動計算
  kintone.events.on(
    ["app.record.create.submit", "app.record.edit.submit"],
    event => {
      const record = event.record;
      const participantNumber = Number.parseInt(record["参加人数"].value, 10);
      const paymentTable = record["支払いテーブル"].value;
      const ajustmentTable = record["精算テーブル"].value;
      const totalCharge = Number.parseInt(record["合計"].value, 10);

      record["部費利用可能上限"].value = calcLimitSubsidy(
        participantNumber,
        totalCharge
      );
      calcAjustmentTablePerCharge(participantNumber, ajustmentTable);
      calcIndividualPayment(paymentTable, ajustmentTable);
      calcIndividualExpenses(paymentTable);
      calcIndividualTemporaryPayment(paymentTable, ajustmentTable);
      calcIndividualAjustment(paymentTable);

      return event;
    }
  );
})();
