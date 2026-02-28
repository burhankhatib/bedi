import re

with open('components/Orders/OrderDetailsModal.tsx', 'r') as f:
    content = f.read()

# Add showOfflineDrivers state
content = content.replace('const [loadingDrivers, setLoadingDrivers] = useState(false)', 'const [loadingDrivers, setLoadingDrivers] = useState(false)\n  const [showOfflineDrivers, setShowOfflineDrivers] = useState(false)')

# Remove old delivery block & update status block
# We will use regex to find the start of Driver Assignment and end of Cancel row
start_marker = "{/* Driver Assignment (for delivery orders) — special section: Request Delivery by default, expand to choose specific driver */}"
end_marker = "{/* Report form modal */}"

parts = content.split(start_marker)
if len(parts) == 2:
    prefix = parts[0]
    subparts = parts[1].split(end_marker)
    if len(subparts) >= 2:
        suffix = end_marker + subparts[1]
        
        # Now we construct the new UI
        new_ui = """{/* Unified Status Timeline */}
        <div className="space-y-4 my-8">
          <h3 className="font-black text-lg text-slate-900 mb-4">{t('Update Order Status', 'تحديث حالة الطلب')}</h3>

          {(() => {
            const currentStatus = localOrder.status
            const isDelivery = localOrder.orderType === 'delivery'
            const isDineIn = localOrder.orderType === 'dine-in'
            const canChangeStatus = !['completed', 'served', 'cancelled', 'refunded'].includes(currentStatus)
            
            // Helper to render a step
            const StepButton = ({ 
              isActive, 
              isCompleted, 
              onClick, 
              icon: Icon, 
              labelEn, 
              labelAr, 
              colorClass,
              children 
            }: {
              isActive: boolean
              isCompleted: boolean
              onClick?: () => void
              icon: any
              labelEn: string
              labelAr: string
              colorClass: string
              children?: React.ReactNode
            }) => {
              if (isCompleted) {
                return (
                  <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 opacity-60">
                    <CheckCircle2 className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-slate-500 line-through">{t(labelEn, labelAr)}</span>
                  </div>
                )
              }
              
              if (isActive) {
                return (
                  <div className={`p-1 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 ${colorClass.replace('bg-', 'border-').replace('500', '300')}`}>
                    <Button
                      onClick={onClick}
                      className={`w-full ${colorClass} hover:opacity-90 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 h-16 shadow-sm`}
                    >
                      <Icon className="w-6 h-6" />
                      {t(labelEn, labelAr)}
                    </Button>
                    {children && <div className="p-3">{children}</div>}
                  </div>
                )
              }
              
              // Upcoming
              return (
                <Button
                  disabled
                  className={`w-full ${colorClass} opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 h-10`}
                >
                  <Icon className="w-4 h-4" />
                  {t(labelEn, labelAr)}
                </Button>
              )
            }

            if (isDelivery) {
              const s1Active = currentStatus === 'new'
              const s1Done = ['preparing', 'waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)
              
              const s2Active = currentStatus === 'preparing'
              const s2Done = ['waiting_for_delivery', 'driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)
              
              const s3Active = currentStatus === 'waiting_for_delivery' || (currentStatus === 'driver_on_the_way' && localOrder.assignedDriver)
              const s3Done = currentStatus === 'out-for-delivery' || currentStatus === 'completed'
              
              const s4Active = currentStatus === 'driver_on_the_way' && !s3Active // Wait, if assigned, it's still driver_on_the_way. Actually:
              // Step 4: Picked up is active when driver_on_the_way
              // Let's refine Step 3 & 4. 
              // Step 3 is "Request / Assign Delivery" active when waiting_for_delivery OR when driver_on_the_way (but then it's just showing the driver info, no button to assign).
              // Let's make Step 3 active if waiting_for_delivery. If driver_on_the_way, Step 3 is considered "Done" (assigned), and Step 4 is active.
              
              const step3Active = currentStatus === 'waiting_for_delivery'
              const step3Done = ['driver_on_the_way', 'out-for-delivery', 'completed'].includes(currentStatus)

              const step4Active = currentStatus === 'driver_on_the_way'
              const step4Done = ['out-for-delivery', 'completed'].includes(currentStatus)

              const step5Active = currentStatus === 'out-for-delivery'
              const step5Done = currentStatus === 'completed'

              return (
                <div className="flex flex-col gap-3">
                  <StepButton isActive={s1Active} isCompleted={s1Done} onClick={() => onStatusUpdate(localOrder._id, 'preparing')} icon={ChefHat} labelEn="Start Preparing" labelAr="بدء التحضير" colorClass="bg-orange-500" />
                  
                  <StepButton isActive={s2Active} isCompleted={s2Done} onClick={() => onStatusUpdate(localOrder._id, 'waiting_for_delivery')} icon={Package} labelEn="Order is Ready" labelAr="الطلب جاهز" colorClass="bg-amber-500" />
                  
                  {/* Step 3: Request / Assign */}
                  {step3Done ? (
                    <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 opacity-80">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-slate-400" />
                        <span className="font-bold text-slate-500 line-through">{t('Driver Assigned', 'تم تعيين السائق')}</span>
                      </div>
                      {localOrder.assignedDriver && (
                        <div className="ml-8 rtl:mr-8 rtl:ml-0 flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                          <div>
                            <p className="font-bold text-slate-800">{localOrder.assignedDriver.name}</p>
                            <p className="text-sm text-slate-500">{localOrder.assignedDriver.phoneNumber}</p>
                          </div>
                          <div className="flex gap-2">
                            {tenantSlug && (
                              <Button onClick={unassignDriver} disabled={unassigningDriver} variant="ghost" size="sm" className="text-orange-600 hover:bg-orange-50 px-2 h-8">
                                {unassigningDriver ? '...' : t('Unassign', 'إلغاء التعيين')}
                              </Button>
                            )}
                            <Button onClick={() => sendWhatsAppToDriver(localOrder.assignedDriver!)} variant="ghost" size="sm" className="text-green-600 hover:bg-green-50 px-2 h-8">
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : step3Active ? (
                    <div className="p-1 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-blue-300">
                      <div className="flex gap-2 mb-2 px-1 pt-1">
                        <Button
                          onClick={requestDelivery}
                          disabled={requestingDriver}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg h-16 shadow-sm"
                        >
                          <Truck className="w-6 h-6 mr-2 rtl:ml-2 rtl:mr-0" />
                          {requestingDriver ? t('Requesting...', 'جارٍ الطلب...') : t('Request Delivery', 'طلب توصيل')}
                        </Button>
                        <Button
                          onClick={handleOrderACaptain}
                          variant="outline"
                          className="w-16 h-16 rounded-2xl border-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-50 shrink-0"
                        >
                          <User className="w-6 h-6" />
                        </Button>
                      </div>
                      
                      {tenantSlug && !loadingBusinessLocation && (!businessLocation?.country?.trim() || !businessLocation?.city?.trim()) && (
                        <div className="mx-2 mb-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-900 border border-amber-200">
                          {t('Set your business location in settings to request drivers.', 'حدّد موقع عملك في الإعدادات لطلب السائقين.')}
                        </div>
                      )}

                      {showDriverSelector && (
                        <div className="mx-2 mb-2 p-4 bg-white rounded-2xl border border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-bold text-slate-800">{t('Available Drivers', 'السائقون المتاحون')}</p>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                              <input type="checkbox" checked={showOfflineDrivers} onChange={(e) => setShowOfflineDrivers(e.target.checked)} className="rounded border-slate-300" />
                              {t('Show offline', 'إظهار غير المتصلين')}
                            </label>
                          </div>
                          
                          {loadingDrivers ? (
                            <p className="text-center text-slate-500 py-4 text-sm">{t('Loading...', 'جارٍ التحميل...')}</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {drivers.filter(d => showOfflineDrivers || d.isOnline).map((driver) => {
                                const canServeArea = !localOrder.deliveryArea || !driver.deliveryAreas || driver.deliveryAreas.length === 0 || driver.deliveryAreas.some(area => area._id === localOrder.deliveryArea?._id)
                                return (
                                  <div key={driver._id} className={`flex items-center justify-between p-3 rounded-xl border ${canServeArea ? 'border-slate-200' : 'border-orange-200 bg-orange-50'}`}>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm">{driver.name}</p>
                                        {driver.isOnline ? (
                                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        ) : (
                                          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500">{driver.phoneNumber}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button onClick={() => sendWhatsAppToDriver(driver)} size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600">
                                        <MessageCircle className="w-4 h-4" />
                                      </Button>
                                      <Button onClick={() => assignDriver(driver._id)} disabled={assigningDriverId !== null} size="sm" className="h-8 px-3 rounded-lg text-xs font-bold">
                                        {t('Assign', 'تعيين')}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                              {drivers.filter(d => showOfflineDrivers || d.isOnline).length === 0 && (
                                <p className="text-center text-slate-500 py-4 text-sm">{t('No drivers found.', 'لم يتم العثور على سائقين.')}</p>
                              )}
                            </div>
                          )}
                          <Button onClick={() => setShowDriverSelector(false)} variant="ghost" size="sm" className="w-full mt-2 text-slate-500 hover:text-slate-700">
                            {t('Close', 'إغلاق')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <StepButton isActive={false} isCompleted={false} icon={Truck} labelEn="Request Delivery" labelAr="طلب توصيل" colorClass="bg-blue-600" />
                  )}

                  <StepButton isActive={step4Active} isCompleted={step4Done} onClick={() => onStatusUpdate(localOrder._id, 'out-for-delivery')} icon={Package} labelEn="Order Picked up" labelAr="تم استلام الطلب" colorClass="bg-purple-500" />
                  
                  <StepButton isActive={step5Active} isCompleted={step5Done} onClick={() => onStatusUpdate(localOrder._id, 'completed')} icon={CheckCircle2} labelEn="Completed" labelAr="مكتمل" colorClass="bg-green-600" />

                </div>
              )
            }

            // Dine-in / Receive in person
            const s1Active = currentStatus === 'new'
            const s1Done = ['preparing', 'served', 'completed'].includes(currentStatus)
            
            const s2Active = currentStatus === 'preparing'
            const s2Done = ['served', 'completed'].includes(currentStatus)

            const s3Active = isDineIn ? currentStatus === 'served' : currentStatus === 'preparing' // For receive-in-person, it jumps to completed after preparing
            // Wait, for receive-in-person, there is no served.
            // Let's do:
            return (
              <div className="flex flex-col gap-3">
                <StepButton isActive={s1Active} isCompleted={s1Done} onClick={() => onStatusUpdate(localOrder._id, 'preparing')} icon={ChefHat} labelEn="Start Preparing" labelAr="بدء التحضير" colorClass="bg-orange-500" />
                
                {isDineIn && (
                  <StepButton isActive={s2Active} isCompleted={s2Done} onClick={() => onStatusUpdate(localOrder._id, 'served')} icon={UtensilsCrossed} labelEn="Mark as Served" labelAr="تم التقديم للعميل" colorClass="bg-emerald-600" />
                )}

                <StepButton isActive={isDineIn ? currentStatus === 'served' : s2Active} isCompleted={currentStatus === 'completed'} onClick={() => onStatusUpdate(localOrder._id, 'completed')} icon={CheckCircle2} labelEn="Completed" labelAr="مكتمل" colorClass="bg-green-600" />
              </div>
            )
          })()}

          {/* Cancel and Refund */}
          {canChangeStatus && (
            <div className="flex flex-wrap gap-3 pt-4 mt-6 border-t border-slate-200">
              <Button
                onClick={() => setConfirmAction('cancelled')}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl font-bold h-11"
              >
                <XCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Cancel', 'إلغاء')}
              </Button>
              <Button
                onClick={() => setConfirmAction('refunded')}
                variant="outline"
                className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 rounded-xl font-bold h-11"
              >
                <RotateCcw className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                {t('Refund', 'استرداد')}
              </Button>
            </div>
          )}

        """
        
        with open('components/Orders/OrderDetailsModal.tsx', 'w') as f:
            f.write(prefix + new_ui + suffix)
